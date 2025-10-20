/**
 * ChromaDB Server Manager
 * Manages on-demand ChromaDB server startup and shutdown with process isolation
 */

import { spawn, ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path, { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { findAvailablePort, waitForService } from './portUtils.js'

export interface ChromaServerConfig {
  /** 技能目录路径 */
  skillDir: string
  /** 临时目录名称 */
  tempDirName?: string
  /** 端口号（可选，如果不指定会自动分配） */
  port?: number
  /** 服务器启动超时时间（毫秒） */
  startupTimeout?: number
}

export interface ChromaServerInfo {
  /** 端口号 */
  port: number
  /** 数据目录路径 */
  dataPath: string
  /** 进程实例 */
  process: ChildProcess
  /** 配置信息 */
  config: ChromaServerConfig
}

export class ChromaServerManager {
  private static instance: ChromaServerManager | null = null
  private servers: Map<string, ChromaServerInfo> = new Map()
  private chromaCliPath: string | null = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ChromaServerManager {
    if (!ChromaServerManager.instance) {
      ChromaServerManager.instance = new ChromaServerManager()
    }
    return ChromaServerManager.instance
  }

  /**
   * 初始化 ChromaDB CLI 路径
   */
  private async initChromaCliPath(): Promise<string> {
    if (this.chromaCliPath) return this.chromaCliPath

    try {
      // 首先尝试从当前项目目录查找
      let projectDir = process.cwd()

      // 如果我们在 skill 目录中，需要向上查找找到包含 node_modules 的项目根目录
      while (!existsSync(join(projectDir, 'node_modules', 'chromadb')) && projectDir !== '/') {
        projectDir = dirname(projectDir)
      }

      const nodeModulesPath = join(projectDir, 'node_modules')
      const chromaDir = join(nodeModulesPath, 'chromadb')
      const cliPath = join(chromaDir, 'dist', 'cli.mjs')

      if (existsSync(cliPath)) {
        console.log(`✅ Found ChromaDB CLI: ${cliPath}`)
        return (this.chromaCliPath = cliPath)
      } else {
        throw new Error(`ChromaDB CLI not found at ${cliPath}`)
      }
    } catch (error) {
      throw new Error(
        `Failed to locate ChromaDB CLI: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 生成服务器唯一标识（基于skill目录）
   */
  private generateServerId(config: ChromaServerConfig): string {
    // 简化ID生成，直接使用skill目录的hash
    const hash = createHash('md5')
    hash.update(config.skillDir)
    return hash.digest('hex').substring(0, 12)
  }

  /**
   * 启动 ChromaDB 服务器（在独立进程中）
   */
  async startServer(config: ChromaServerConfig): Promise<ChromaServerInfo> {
    const chromaCliPath = await this.initChromaCliPath()

    const serverId = this.generateServerId(config)

    // 检查服务器是否已经运行
    if (this.servers.has(serverId)) {
      const existingServer = this.servers.get(serverId)!
      if (existingServer.process && !existingServer.process.killed) {
        console.log(`📡 ChromaDB 服务器已在运行 (端口: ${existingServer.port})`)
        return existingServer
      } else {
        // 清理死进程
        this.servers.delete(serverId)
      }
    }

    console.log('🚀 启动 ChromaDB 服务器...')

    // 分配端口
    const port = config.port || (await findAvailablePort())

    // 创建持久化目录：assets/chromadb
    const chromaDir = join(config.skillDir, 'chromadb')
    if (!existsSync(chromaDir)) {
      mkdirSync(chromaDir, { recursive: true })
    }

    console.log(`🔧 启动命令: chroma run --path ./chromadb --port ${port} --host localhost`)
    console.log(`📁 数据目录: ${chromaDir}`)
    console.log(`🌐 服务端口: ${port}`)
    console.log(`🔄 工作目录: ${config.skillDir}`)

    // 启动进程 - 从项目根目录启动以确保能找到依赖
    const subprocess = spawn(process.argv[0], [chromaCliPath, 'run', '--port', port.toString()], {
      stdio: 'ignore',
      detached: true,
      cwd: chromaDir,
    })
    subprocess.unref()

    subprocess.on('error', (error: Error) => {
      console.log('❌ ChromaDB 进程错误:', error.message)
    })

    subprocess.on('exit', (code: number | null, signal: string | null) => {
      console.log(`🔚 ChromaDB 进程退出 (code: ${code}, signal: ${signal})`)
      this.servers.delete(serverId)
    })

    // 等待服务器启动
    const startupTimeout = config.startupTimeout || 15000
    console.log(`⏳ 等待 ChromaDB 服务器启动 (超时: ${startupTimeout}ms)...`)

    const isStarted = await waitForService(port, startupTimeout)

    if (!isStarted) {
      subprocess.kill('SIGTERM')
      throw new Error(`ChromaDB 服务器启动超时 (端口: ${port})`)
    }

    console.log(`✅ ChromaDB 服务器启动成功 (端口: ${port})`)

    // 保存服务器信息
    const serverInfo: ChromaServerInfo = {
      port,
      dataPath: chromaDir,
      process: subprocess,
      config,
    }

    this.servers.set(serverId, serverInfo)
    return serverInfo
  }

  /**
   * 停止 ChromaDB 服务器
   */
  async stopServer(config: ChromaServerConfig): Promise<void> {
    const serverId = this.generateServerId(config)
    const serverInfo = this.servers.get(serverId)

    if (!serverInfo) {
      console.log('⚠️  ChromaDB 服务器未运行')
      return
    }

    console.log(`🛑 停止 ChromaDB 服务器 (端口: ${serverInfo.port})...`)

    try {
      // 尝试优雅关闭
      serverInfo.process.kill('SIGTERM')

      // 等待进程结束
      const timeout = setTimeout(() => {
        if (!serverInfo.process.killed) {
          console.log('⚡ 强制终止 ChromaDB 进程...')
          serverInfo.process.kill('SIGKILL')
        }
      }, 5000)

      serverInfo.process.on('exit', () => {
        clearTimeout(timeout)
      })

      this.servers.delete(serverId)
      console.log('✅ ChromaDB 服务器已停止')
    } catch (error) {
      console.error('❌ 停止 ChromaDB 服务器时出错:', error)
    }
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map(async (serverInfo) => {
      try {
        serverInfo.process.kill('SIGTERM')
      } catch (error) {
        console.error(`停止服务器时出错 (端口: ${serverInfo.port}):`, error)
      }
    })

    await Promise.all(stopPromises)
    this.servers.clear()
    console.log('✅ 所有 ChromaDB 服务器已停止')
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(config: ChromaServerConfig): ChromaServerInfo | null {
    const serverId = this.generateServerId(config)
    return this.servers.get(serverId) || null
  }

  /**
   * 检查服务器是否运行
   */
  isServerRunning(config: ChromaServerConfig): boolean {
    const serverInfo = this.getServerInfo(config)
    return serverInfo !== null && serverInfo.process && !serverInfo.process.killed
  }
}
