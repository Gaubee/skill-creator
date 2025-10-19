/**
 * ChromaDB 服务器管理器
 * 负责按需启动和关闭 ChromaDB 服务器
 */

import { spawn, ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { findAvailablePort, waitForService } from './portUtils.js'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

export interface ChromaServerConfig {
  /** skill 目录路径 */
  skillDir: string
  /** 临时目录名称 */
  tempDirName?: string
  /** 端口号（可选，如果不指定会自动分配） */
  port?: number
  /** 服务器启动超时时间（毫秒） */
  startupTimeout?: number
}

export interface ChromaServerInfo {
  port: number
  dataPath: string
  process: ChildProcess
  config: ChromaServerConfig
}

/**
 * ChromaDB 服务器管理器
 * 提供按需启动、管理和关闭 ChromaDB 服务器的功能
 */
export class ChromaServerManager {
  private static instance: ChromaServerManager | null = null
  private servers: Map<string, ChromaServerInfo> = new Map()
  private chromaCliPath: string | null = null
  private projectRoot: string | null = null

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
  private async initChromaCliPath(): Promise<void> {
    if (this.chromaCliPath) return

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
        this.chromaCliPath = cliPath
        this.projectRoot = projectDir
        console.log(`✅ Found ChromaDB CLI: ${cliPath}`)
        console.log(`📁 Project root: ${projectDir}`)
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
   * 生成服务器唯一标识
   */
  private generateServerId(config: ChromaServerConfig): string {
    const hash = createHash('md5')
    hash.update(config.skillDir)
    hash.update(config.tempDirName || 'default')
    return hash.digest('hex').substring(0, 12)
  }

  /**
   * 启动 ChromaDB 服务器
   */
  async startServer(config: ChromaServerConfig): Promise<ChromaServerInfo> {
    await this.initChromaCliPath()

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

    // 创建临时数据目录
    const tempDirName = config.tempDirName || `chroma_temp_${Date.now()}`
    const dataPath = join(config.skillDir, tempDirName)

    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true })
    }

    // 构建 chroma run 命令
    const args = ['run', '--path', dataPath, '--port', port.toString(), '--host', 'localhost']

    console.log(`🔧 启动命令: chroma ${args.join(' ')}`)
    console.log(`📁 数据目录: ${dataPath}`)
    console.log(`🌐 服务端口: ${port}`)

    // 启动进程 - 从项目根目录启动以确保能找到依赖
    const chromaProcess = spawn('node', [this.chromaCliPath!, ...args], {
      stdio: 'pipe',
      detached: false,
      cwd: this.projectRoot || process.cwd(),
    })

    // 处理进程输出
    chromaProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim()
      if (output) {
        console.log(`📊 ChromaDB: ${output}`)
      }
    })

    chromaProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim()
      if (output && !output.includes('WARN')) {
        console.log(`⚠️  ChromaDB: ${output}`)
      }
    })

    chromaProcess.on('error', (error: Error) => {
      console.log('❌ ChromaDB 进程错误:', error.message)
    })

    chromaProcess.on('exit', (code: number | null, signal: string | null) => {
      console.log(`🔚 ChromaDB 进程退出 (code: ${code}, signal: ${signal})`)
      this.servers.delete(serverId)
    })

    // 等待服务器启动
    const startupTimeout = config.startupTimeout || 15000
    console.log(`⏳ 等待 ChromaDB 服务器启动 (超时: ${startupTimeout}ms)...`)

    const isStarted = await waitForService(port, startupTimeout)

    if (!isStarted) {
      chromaProcess.kill('SIGTERM')
      throw new Error(`ChromaDB 服务器启动超时 (端口: ${port})`)
    }

    console.log(`✅ ChromaDB 服务器启动成功 (端口: ${port})`)

    // 保存服务器信息
    const serverInfo: ChromaServerInfo = {
      port,
      dataPath,
      process: chromaProcess,
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
      console.log('ℹ️  ChromaDB 服务器未运行')
      return
    }

    console.log(`🛑 停止 ChromaDB 服务器 (端口: ${serverInfo.port})...`)

    try {
      // 终止进程
      if (serverInfo.process && !serverInfo.process.killed) {
        serverInfo.process.kill('SIGTERM')

        // 等待进程优雅退出
        const timeout = setTimeout(() => {
          if (!serverInfo.process.killed) {
            console.log('⚡ 强制终止 ChromaDB 进程')
            serverInfo.process.kill('SIGKILL')
          }
        }, 5000)

        serverInfo.process.on('exit', () => {
          clearTimeout(timeout)
        })
      }

      // 清理临时目录
      if (existsSync(serverInfo.dataPath)) {
        try {
          rmSync(serverInfo.dataPath, { recursive: true, force: true })
          console.log(`🗑️  已清理临时目录: ${serverInfo.dataPath}`)
        } catch (error) {
          console.log(
            `⚠️  清理临时目录失败:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }

      // 从管理器中移除
      this.servers.delete(serverId)
      console.log('✅ ChromaDB 服务器已停止')
    } catch (error) {
      console.log(
        '❌ 停止 ChromaDB 服务器失败:',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
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
    return serverInfo ? !serverInfo.process.killed : false
  }

  /**
   * 停止所有服务器
   */
  async stopAllServers(): Promise<void> {
    console.log(`🛑 停止所有 ChromaDB 服务器 (共 ${this.servers.size} 个)...`)

    const stopPromises = Array.from(this.servers.entries()).map(async ([serverId, serverInfo]) => {
      try {
        await this.stopServer(serverInfo.config)
      } catch (error) {
        console.log(
          `❌ 停止服务器 ${serverId} 失败:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    })

    await Promise.allSettled(stopPromises)
    console.log('✅ 所有 ChromaDB 服务器已停止')
  }

  /**
   * 获取运行中的服务器数量
   */
  getRunningServerCount(): number {
    let count = 0
    for (const serverInfo of this.servers.values()) {
      if (!serverInfo.process.killed) {
        count++
      }
    }
    return count
  }

  /**
   * 清理所有资源（用于程序退出时）
   */
  async cleanup(): Promise<void> {
    await this.stopAllServers()
    this.chromaCliPath = null
  }
}
