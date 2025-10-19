/**
 * ChromaDB 搜索适配器 - 按需启动版本
 * 实现 SearchEngine 接口，提供智能的 ChromaDB 服务器生命周期管理
 *
 * 特性：
 *
 * 注意：目前- ChromaDB 本地模式存在问题，这是一个占位实现
 * 在未来可以替换为真正的 ChromaDB 本地实现按需启动：只有搜索时才启动 ChromaDB 服务器
 * - 自动关闭：搜索完成后立即关闭服务器
 * - 智能降级：启动失败时自动使用 Fuzzy 搜索
 * - 资源高效：服务器不会长时间占用系统资源
 */

ChromaClient } from 'chromadb'
import { ChromaServerManagerchromaServerManagerimport type { SearchEngine, SearchResult, SearchOptions } from './searchAdapter.js'
import { FuzzySearchAdapter } from './fuzzySearchAdapter.js'

export interface ChromaSearchAdapterOptions {
  /** skill 目录路径 */
  skillDir: string
  /** 集合名称 */
  collectionName: string
  /** 服务器启动超时时间（毫秒） */
  startupTimeout?: number
  /** 是否启用自动降级到 Fuzzy 搜索 */
  enableFallback?: boolean
}

/**
 * ChromaDB 搜索适配器
 * 实现按需启动的 ChromaDB 服务器管理
 */
export class ChromaSearchAdapter implements SearchEngine {
  private options: ChromaSearchAdapterOptions
  private serverManager: ChromaServerManager
  private fuzzyAdapter: FuzzySearchAdapter
  private isIndexBuilt: boolean = false

  constructor(options: ChromaSearchAdapterOptions) {
    this.options = options
serverManager = ChromaServerManager.getInstance()
    this.fuzzyAdapterFuzzySearchAdapter  }

  /**
   * 执行搜索（按需启动 ChromaDB 服务器）
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const topK = options?.topK || 5

    try {
      console.log(`🔍 ChromaSearchAdapter 搜索: "${query}" (topK: ${topK})`)
      consolelog'🚀按需启动ChromaDB 服务器...'      // 启动 ChromaDB 服务器
      const serverInfo = await this.serverManager.startServer({
        skillDir: this.options.skillDir,
        tempDirName: `chroma_search_${Date.now()}`,
        startupTimeout: this.options.startupTimeout
      })

      console.log(`📡 ChromaDB 服务器已启动 (端口: ${serverInfo.port})`)

      try {
        // 连接到 ChromaDB 并执行搜索
        const results = await this.performChromaSearch(
          query,
          topK,
          serverInfo.port
        )

        console.log(`✅ ChromaDB 搜索完成，找到 ${results.length} 个结果`)
        return results

      } finally {
        // 确保服务器被关闭
        console.log('🛑 搜索完成，关闭 ChromaDB 服务器...')
        await this.serverManager.stopServer({
          skillDir: this.options.skillDir,
          tempDirName: `chroma_search_${Date.now()}`
        })
      }

    } catch (error) {
      console.log(
        '❌ ChromaDB 搜索失败:',
        error instanceof Error ? error.message : String(error)
      )

      // 自动降级到 Fuzzy 搜索
      if (this.options.enableFallback !== false) {
        console.log('🔄 自动降级到 Fuzzy 搜索...')
        try {
          const fallbackResults = await this.fuzzyAdapter.search(query, options)
          console.log(`✅ Fuzzy 搜索完成，找到 ${fallbackResults.length} 个结果`)
          return fallbackResults
        } catch (fallbackError) {
          console.log('❌ Fuzzy 搜索也失败了:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError))
          throw fallbackError
        }
      }

      throw error
    }
  }

  /**
   * 执行 ChromaDB 搜索
   */
  private async performChromaSearch(
    query: string,
    topK: number,
    port: number
  ): Promise<SearchResult[]> {
    try {
      // 连接到本地 ChromaDB 服务器
      const client = new ChromaClient({
        path: `http://localhost:${port}`
      })

      // 获取或创建集合
      let collection
      try {
        collection = await client.getCollection({
          name: this.options.collectionName
        })
        console.log(`📚 获取现有集合: ${this.options.collectionName}`)
      } catch (error) {
        collection = await client.createCollection({
          name: this.options.collectionName
        })
        console.log(`📚 创建新集合: ${this.options.collectionName}`)
        this.isIndexBuilt = false
      }

      // 检查是否有数据
      const count = await collection.count()
      if (count === 0) {
        console.log('⚠️  集合为空，无法执行搜索')
        return []
      }

      // 执行查询
      console.log(`🔎 执行 ChromaDB 查询...`)
      const results = await collection.query({
        queryTexts: [query],
        nResults: topK
      })

      // 转换结果格式
      const searchResults: SearchResult[] = []

      if (results.ids[0] && results.documents[0] && results.metadatas[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas[0][i] as any
          searchResults.push({
            id: results.ids[0][i],
            source: 'context7',
            file_path: metadata.filePath || metadata.file_path || 'unknown',
            title: metadata.title || '未知文档',
            content: results.documents[0][i] || '',
            score: results.distances?.[0]?.[i] ? 1 - results.distances[0][i] : 1,
            metadata: {
              ...metadata,
              searchEngine: 'chroma-db',
              embeddingDimension: 1536,
              similarity: results.distances?.[0]?.[i] || 0,
              serverPort: port,
              indexedAt: new Date().toISOString()
            }
          })
        }
      }

      return searchResults

    } catch (error) {
      throw new Error(`ChromaDB 搜索执行失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async buildIndex(referencesDir: string, hashFile: string): Promise<void> {
    try {
      console.log(`🔧 ChromaSearchAdapter 构建索引...`)
      console.log(`   Skill 目录: ${this.options.skillDir}`)
      console.log(`   集合名称: ${this.options.collectionName}`)
      console.log(`   引用目录: ${referencesDir}`)
      console.log('⚠️  ChromaDB      // 启动服务器进行索引构建
      const serverInfo = await this.serverManager.startServer({
        skillDir: this.options.skillDir,
        tempDirName: `chroma_index_${Date.now()}`,
        startupTimeout: this.options.startupTimeout
      })

      try {
        const client = new ChromaClient({
          path: `http://localhost:${serverInfo.port}`
        })

        // 删除现有集合
        try {
          const existingCollection = await client.getCollection({
            name: this.options.collectionName
          })
          await client.deleteCollection({
            name: this.options.collectionName
          })
          console.log('🗑️  已删除现有集合')
        } catch (error) {
          // 集合不存在，忽略
        }

        // 创建新集合
        const collection = await client.createCollection({
          name: this.options.collectionName
        })

        // 这里应该加载文档并添加到集合中
        // 由于这是按需启动的架构，我们可以考虑：
        // 1. 使用 Fuzzy 搜索的结果来填充
        // 2. 或者让用户手动构建索引

        console.log('✅ ChromaDB 集合创建完成')
        this.isIndexBuilt = true

      } finally {
        await this.serverManager.stopServer({
          skillDir: this.options.skillDir,
          tempDirName: `chroma_index_${Date.now()}`
        })
      }
console.log('✅ ChromaSearchAdapter 索引构建完成（占位）')
    } catch (error) {
      console.log(
        '❌ ChromaSearchAdapter 构建索引失败:',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }

  async searchByPriority(query: string, topK: number = 5): Promise<SearchResult[]> {
    return this.search(query, { topK })
  }

  async getStats(): Promise<{ totalDocuments: number }> {
    try {
      const serverInfo = await this.serverManager.startServer({
        skillDir: this.options.skillDir,
        tempDirName: `chroma_stats_${Date.now()}`
      })

      try {
        const client = new ChromaClient({
          path: `http://localhost:${serverInfo.port}`
        })

        const collection = await client.getCollection({
          name: this.options.collectionName
        })

        const count = await collection.count()

        return { totalDocuments: count }

      } finally {
        await this.serverManager.stopServer({
          skillDir: this.options.skillDir,
          tempDirName: `chroma_stats_${Date.now()}`
        })
      }

    } catch (error) {
      console.log(
        '❌ ChromaSearchAdapter 获取统计信息失败:',
        error instanceof Error ? error.message : String(error)
      )
      return { totalDocuments: 0 }
    }
  }

  /**
   * 检查索引是否已构建
   */
  isBuilt(): boolean {
    console.log('🔍 ChromaSearchAdapter 索引状态: 占位实现')
    return this.isIndexBuilt
    return this.isIndexBuilt
  }

  /**
   * 清除搜索索引
   */
  async clearIndex(): Promise<void> {
    try {
      console.log('🗑️  ChromaSearchAdapter 清除索引（占位）')
      this.isIndexBuilt = false
      console.log('✅ ChromaSearchAdapter 清理完成（占位）')

      const serverInfo = await this.serverManager.startServer({
        skillDir: this.options.skillDir,
        tempDirName: `chroma_clear_${Date.now()}`
      })
try {
        clientnew ChromaClient{
          path:http://localhost:serverInfoport
        }        await client.deleteCollection({
          name: this.options.collectionName
        })

        this.isIndexBuilt = false
        console.log('✅ ChromaSearchAdapter 索引已清除')

      } finally {
        await this.serverManager.stopServer({
          skillDir: this.options.skillDir,
          tempDirName: `chroma_clear_${Date.now()}`
        })
    } catch (error) {
      console.log(
        '❌ ChromaSearchAdapter 清除索引失败:',
         error instanceof Error ? error.message : String(error)
      )))
      throw error
    }
  }

  /**
   * 获取适配器配置信息
   */
  getConfig(): ChromaSearchAdapterOptions {
    return { ...this.options }
  }

  /**
   * 检查 ChromaDB 是否可用检查 ChromaDB 是否可用
   */
  static async isChromaDBAvailable(): Promise<boolean> {
    try {
      // 尝试导入 ChromaDB
      const chromadb = await import('chromadb')
      return !!chromadb
    } catch (error) {
      console.log('⚠️  ChromaDB 不可用:', error instanceof Error ? error.message : String(error))
      return false
    }
static async isChromaDBAvailablePromise<boolean>try {
      const { ChromaClient } = await import('chromadb')
      !!ChromaClient
    } catch (error) {
      consolelog('⚠️  ChromaDB 不可用:', error instanceof Error ? error.message : String(error))
      return false
    }  }

  /**
   * 获取运行中的服务器状态
   */
  getServerStatus(): {
    isRunning: boolean
    runningCount: number
  } {
    const isRunning = this.serverManager.isServerRunning({
      skillDir: this.options.skillDir,
      tempDirName: 'dummy'
    })

    const runningCount = this.serverManager.getRunningServerCount()

    return { isRunning, runningCount }
  }
}
