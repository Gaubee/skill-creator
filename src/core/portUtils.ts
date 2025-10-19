/**
 * 端口管理工具
 * 用于动态分配和管理 ChromaDB 服务器端口
 */

import { createServer } from 'node:net'
import { promisify } from 'node:util'

/**
 * 查找可用的端口
 * @param startPort 起始端口号
 * @param maxPort 最大端口号
 * @returns 可用的端口号
 */
export async function findAvailablePort(
  startPort: number = 8000,
  maxPort: number = 9000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > maxPort) {
        reject(new Error(`No available ports found between ${startPort} and ${maxPort}`))
        return
      }

      const server = createServer()

      server.listen(port, () => {
        const actualPort = (server.address() as any)?.port
        server.close(() => {
          resolve(actualPort)
        })
      })

      server.on('error', () => {
        // 端口被占用，尝试下一个端口
        tryPort(port + 1)
      })
    }

    tryPort(startPort)
  })
}

/**
 * 检查端口是否可用
 * @param port 端口号
 * @returns 端口是否可用
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()

    server.listen(port, () => {
      const actualPort = (server.address() as any)?.port
      server.close(() => {
        resolve(actualPort === port)
      })
    })

    server.on('error', () => {
      resolve(false)
    })
  })
}

/**
 * 等待端口上的服务启动
 * @param port 端口号
 * @param timeout 超时时间（毫秒）
 * @returns 服务是否成功启动
 */
export async function waitForService(
  port: number,
  timeout: number = 10000
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now()

    const checkService = () => {
      if (Date.now() - startTime > timeout) {
        resolve(false)
        return
      }

      const socket = new (require('net').Socket)()

      socket.setTimeout(1000)

      socket.connect(port, 'localhost', () => {
        socket.destroy()
        resolve(true)
      })

      socket.on('error', () => {
        setTimeout(checkService, 500)
      })

      socket.on('timeout', () => {
        socket.destroy()
        setTimeout(checkService, 500)
      })
    }

    checkService()
  })
}

/**
 * 端口管理器类
 */
export class PortManager {
  private usedPorts: Set<number> = new Set()
  private basePort: number

  constructor(basePort: number = 8000) {
    this.basePort = basePort
  }

  /**
   * 分配一个可用端口
   * @returns 分配的端口号
   */
  async allocatePort(): Promise<number> {
    let port = this.basePort

    // 找到下一个可用端口
    while (this.usedPorts.has(port) || !(await isPortAvailable(port))) {
      port++
    }

    this.usedPorts.add(port)
    return port
  }

  /**
   * 释放端口
   * @param port 要释放的端口号
   */
  releasePort(port: number): void {
    this.usedPorts.delete(port)
  }

  /**
   * 获取当前已使用的端口数量
   */
  getUsedPortCount(): number {
    return this.usedPorts.size
  }

  /**
   * 清理所有端口
   */
  cleanup(): void {
    this.usedPorts.clear()
  }
}
