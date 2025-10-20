/**
 * ChromaDB Search Adapter
 * Implements on-demand ChromaDB search with automatic fallback to fuzzy search
 */

import { ChromaClient } from 'chromadb'
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed'
import type { SearchEngine, SearchResult, SearchOptions } from './searchAdapter.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'
import { ChromaServerManager } from './chromaServerManager.js'

export interface ChromaSearchOptions {
  /** 技能目录路径 */
  skillDir: string
  /** ChromaDB 集合名称 */
  collectionName: string
  /** 启动超时时间（毫秒） */
  startupTimeout?: number
  /** 是否启用自动回退 */
  enableFallback?: boolean
}

export interface ChromaPreparedResult {
  /** ChromaDB 客户端 */
  client: ChromaClient
  /** 服务器信息 */
  serverInfo: {
    port: number
    dataPath: string
  }
  /** 是否需要自动关闭服务器 */
  shouldAutoShutdown: boolean
}

/**
 * ChromaDB Search Adapter
 * 支持按需启动、自动回退和优雅关闭
 */
export class ChromaSearchAdapter implements SearchEngine {
  private fuzzyAdapter: FuzzySearchAdapter
  private serverManager: ChromaServerManager
  private options: ChromaSearchOptions
  private isIndexBuilt = false

  constructor(options: ChromaSearchOptions) {
    this.options = options
    this.fuzzyAdapter = new FuzzySearchAdapter()
    this.serverManager = ChromaServerManager.getInstance()
  }

  /**
   * 统一准备ChromaDB环境
   * 封装服务器启动、客户端创建和配置的通用逻辑
   */
  private async prepareChromadb(
    operation: 'search' | 'build-index' | 'clear-index' = 'search',
    autoShutdown: boolean = true
  ): Promise<ChromaPreparedResult> {
    // 检查服务器是否已运行
    const isServerRunning = this.serverManager.isServerRunning({
      skillDir: this.options.skillDir,
    })

    let serverInfo
    let shouldAutoShutdown = autoShutdown

    if (isServerRunning) {
      // 服务器已运行，获取现有信息
      serverInfo = this.serverManager.getServerInfo({
        skillDir: this.options.skillDir,
      })!
      console.log(`🔄 使用现有的 ChromaDB 服务器 (端口: ${serverInfo.port})`)
      shouldAutoShutdown = false // 现有服务器不自动关闭
    } else {
      // 启动新服务器
      serverInfo = await this.serverManager.startServer({
        skillDir: this.options.skillDir,
        startupTimeout: this.options.startupTimeout,
      })
    }

    // 创建ChromaDB客户端
    console.log(`🔗 连接到 ChromaDB: http://localhost:${serverInfo.port}`)
    const client = new ChromaClient({
      path: `http://localhost:${serverInfo.port}`,
    })

    // 测试连接
    try {
      await client.heartbeat()
      console.log(`✅ ChromaDB 连接成功`)
    } catch (error) {
      throw new Error(
        `ChromaDB 连接失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    return {
      client,
      serverInfo: {
        port: serverInfo.port,
        dataPath: serverInfo.dataPath,
      },
      shouldAutoShutdown,
    }
  }

  /**
   * 安全关闭ChromaDB服务器
   */
  private async safeShutdownServer(
    serverInfo: { port: number; dataPath: string },
    shouldShutdown: boolean
  ): Promise<void> {
    if (!shouldShutdown) {
      console.log(`🔄 保持 ChromaDB 服务器运行 (端口: ${serverInfo.port})`)
      return
    }

    try {
      await this.serverManager.stopServer({
        skillDir: this.options.skillDir,
      })
      console.log(`✅ ChromaDB 服务器已关闭 (端口: ${serverInfo.port})`)
    } catch (error) {
      console.warn(`⚠️ 关闭 ChromaDB 服务器时出现警告:`, error)
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { topK = 5, where } = options

    try {
      console.log('🔍 启动 ChromaDB 搜索...')

      // 准备ChromaDB环境
      const { client, serverInfo, shouldAutoShutdown } = await this.prepareChromadb('search')

      try {
        // 获取或创建集合
        let collection
        try {
          collection = await client.getCollection({
            name: this.options.collectionName,
          })
          console.log(`📚 获取现有集合: ${this.options.collectionName}`)
        } catch (error) {
          if (!this.isIndexBuilt) {
            console.log(`⚠️ 集合不存在且索引未构建，跳过 ChromaDB 搜索`)
            throw new Error('ChromaDB 索引未构建')
          }
          throw error
        }

        // 检查是否有数据
        try {
          const count = await collection.count()
          if (count === 0) {
            console.log(`📭 集合为空，跳过 ChromaDB 搜索`)
            throw new Error('ChromaDB 集合为空')
          }
        } catch (error) {
          console.log(`⚠️ 无法获取集合计数，可能集合为空`)
          throw new Error('ChromaDB 集合不可访问')
        }

        // 执行搜索
        console.log(`🔎 查询 ChromaDB: "${query}"`)
        const results = await collection.query({
          queryTexts: [query],
          nResults: topK,
        })

        // 转换结果
        const searchResults: SearchResult[] = []
        if (results.ids[0] && results.ids[0].length > 0) {
          for (let i = 0; i < results.ids[0].length; i++) {
            const id = results.ids[0][i]
            const document = results.documents[0]?.[i]
            const metadata = results.metadatas[0]?.[i]

            if (id && document) {
              searchResults.push({
                id,
                title: (typeof metadata?.title === 'string'
                  ? metadata.title
                  : `Document ${id}`) as string,
                content: document,
                source: (metadata?.source === 'user' || metadata?.source === 'context7'
                  ? metadata.source
                  : 'user') as 'user' | 'context7',
                file_path: (typeof metadata?.file_path === 'string'
                  ? metadata.file_path
                  : `unknown/${id}`) as string,
                score: 1 - (results.distances?.[0]?.[i] || 0), // Convert distance to similarity
                metadata: {
                  ...metadata,
                  similarity: results.distances?.[0]?.[i] || 0,
                  serverPort: serverInfo.port,
                  indexedAt: new Date().toISOString(),
                },
              })
            }
          }
        }

        console.log(`✅ ChromaDB 搜索完成，找到 ${searchResults.length} 个结果`)
        return searchResults
      } finally {
        // 安全关闭服务器
        await this.safeShutdownServer(serverInfo, shouldAutoShutdown)
      }
    } catch (error) {
      console.log(`❌ ChromaDB 搜索失败: ${error instanceof Error ? error.message : String(error)}`)

      // 自动回退到模糊搜索
      if (this.options.enableFallback) {
        console.log('🔄 自动回退到模糊搜索...')
        return this.fuzzyAdapter.search(query, { topK, where })
      }

      throw error
    }
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    console.log('🔧 构建 ChromaDB 索引...')

    // 准备ChromaDB环境
    const { client, serverInfo, shouldAutoShutdown } = await this.prepareChromadb(
      'build-index',
      false
    )

    try {
      // 删除现有集合
      try {
        const existingCollection = await client.getCollection({
          name: this.options.collectionName,
        })
        await client.deleteCollection({
          name: this.options.collectionName,
        })
        console.log('🗑️  已删除现有集合')
      } catch (error) {
        // 集合不存在，忽略
      }

      // 创建新集合
      const collection = await client.createCollection({
        name: this.options.collectionName,
      })
      console.log(`📝 创建新集合: ${this.options.collectionName}`)

      // 读取并索引文档
      const fs = await import('node:fs')
      const { glob } = await import('glob')
      const { join, relative } = await import('node:path')

      const files = await glob('**/*.md', { cwd: referencesDir })
      console.log(`📄 找到 ${files.length} 个文档`)

      if (files.length === 0) {
        console.log('⚠️ 没有找到文档文件')
        return
      }

      // 准备嵌入函数
      const embedder = new DefaultEmbeddingFunction()

      // 分批处理文档
      const batchSize = 50
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        const documents: string[] = []
        const ids: string[] = []
        const metadatas: any[] = []

        for (const file of batch) {
          try {
            const fullPath = join(referencesDir, file)
            const content = fs.readFileSync(fullPath, 'utf-8')

            // 提取标题
            const lines = content.split('\n')
            const title = lines[0]?.replace(/^#+\s*/, '').trim() || file.replace(/\.md$/, '')

            documents.push(content)
            ids.push(file)
            metadatas.push({
              title,
              file_path: file,
              source: file.includes('context7/') ? 'context7' : 'user',
              file_name: file.split('/').pop() || file,
            })
          } catch (error) {
            console.warn(`⚠️ 读取文件失败 ${file}:`, error)
          }
        }

        if (documents.length > 0) {
          await collection.add({
            ids,
            documents,
            metadatas,
          })
          console.log(`📚 已索引 ${i + documents.length}/${files.length} 个文档`)
        }
      }

      this.isIndexBuilt = true
      console.log(`✅ ChromaDB 索引构建完成 (端口: ${serverInfo.port})`)
    } finally {
      // 安全关闭服务器
      await this.safeShutdownServer(serverInfo, shouldAutoShutdown)
    }
  }

  async clearIndex(): Promise<void> {
    console.log('🗑️ 清除 ChromaDB 索引...')

    // 准备ChromaDB环境
    const { client, serverInfo, shouldAutoShutdown } = await this.prepareChromadb(
      'clear-index',
      false
    )

    try {
      try {
        await client.deleteCollection({
          name: this.options.collectionName,
        })
        console.log('✅ ChromaDB 索引已清除')
      } catch (error) {
        console.log('⚠️ ChromaDB 集合不存在或已清除')
      }

      this.isIndexBuilt = false
    } finally {
      // 安全关闭服务器
      await this.safeShutdownServer(serverInfo, shouldAutoShutdown)
    }
  }

  isBuilt(): boolean {
    return this.isIndexBuilt
  }

  async getStats(): Promise<{ totalDocuments: number }> {
    try {
      // 准备ChromaDB环境
      const { client, shouldAutoShutdown } = await this.prepareChromadb('search')

      try {
        const collection = await client.getCollection({
          name: this.options.collectionName,
        })
        const count = await collection.count()
        return { totalDocuments: count }
      } finally {
        // 安全关闭服务器
        if (shouldAutoShutdown) {
          await this.serverManager.stopServer({
            skillDir: this.options.skillDir,
          })
        }
      }
    } catch (error) {
      console.log(`⚠️ 无法获取 ChromaDB 统计信息:`, error)
      return { totalDocuments: 0 }
    }
  }

  /**
   * 获取运行中的服务器状态
   */
  getServerStatus(): {
    isRunning: boolean
  } {
    const isRunning = this.serverManager.isServerRunning({
      skillDir: this.options.skillDir,
    })

    return { isRunning }
  }
}
