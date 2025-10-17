任务必读资料：

1. `/Users/kzf/.claude/agents/doc-downloader.md`
2. `/Users/kzf/.claude/plugins/skills/skill-creator/SKILL.md`

`doc-downloader`是我之前创建了一个 subagents。它的作用是下载 context7 的文档，到一个
`.claude/references`
文件夹中。现在，claude-code 支持了 skills，那么我觉得我们可以对这个 subagetns 进行升级：

升级成一个 `skill-creater` 的 subagents：

1. `skill-creater`
   现在更加可靠，直接使用预设好的脚本程序去进行执行下载，而不再是让 AI 自己去临时执行脚本去做下载。
1. 它不再是产生在 `.claude/references`
   目录下， 而是基于 claude-code-skills 的规范，产生在当前项目文件夹（`./.claude/skills/`）或者用户目录(`~/.claude/skills`) 下，
1. 然后请你参考 `skill-creator`
   的规范，同时依赖于文档，去构建我们的 claude-code-skills:

1. 在新建 skill 的时候，需要询问用户，是要存储在 当前项目文件夹 还是 用户目录下。
1. 我们需要为我们新建的 skill 配套一些脚本来实现搜索查找，目的不是让 AI 直接读取一整个 zod 文档：
   1. 我们需要将资料文件下载到 `{skill-name}/assets/references/`
      文件夹中，而不是 `{skill-name}/references/` 文件夹
   1. 因为我们下载的是 context7 的文档，所以它的文档具有规律，可以轻松切片
      > _未来我们可能会引入其它的文档生成器，比如甚至是直接 clone 某个仓库，然后根据源代码，去生成一些使用资料。_
      1. 要切成一个个 `.md` 文件，不能是一个巨大的文件。文件名不限制，可以是
         `0001.md`
         ，也可以基于内容中的标题去做`[TITLE].01.md`（这里`.01`是为了避免 TITLE 一样导致的冲突）。这里文件名的规范不重要，只要确保唯一就行。
      1. 切片完成的要放在 `{skill-name}/assets/references/context7/*.md` 中
      1. 因为我们还会有 `{skill-name}/assets/references/user/*.md`
         文件夹，是用户自己使用习惯生成的一些资料
   1. 我们需要内置 search(js+Chroma) 脚本，来提供资料搜索的能力：
      1. 在执行 search 脚本去执行 Chroma 搜索的时候，需要做一些准备工作：
      1. 要确保已经为资料数据做好来索引构建。注意，这里会基于`{skill-name}/assets/references/`文件夹的文件元数据做 fast-hash，如果 fast-hash 变了，那么就需要重新构建索引。
      1. 存储到 Chroma 中的切片数据的内容要包含引用来源
      1. 最终查询出来的数据要提出引用来源
   1. 我们需要内置 add(js) 脚本，能做到动态添加 `assets/references/user`
      中。
      1. user 的优先级高于 context7 优先级
      1. 添加之前，需要先执行 search，找到相似的资料，如果找到高度相似的内容，那么要判断是否属于升级知识点。
         1. 如果已存在的资料都知识点足够丰富，那么我们就不需要更新。结束 add 程序
         1. 如果已经存在的资料知识点相对成就，我们我们需要继续；：
         1. 因为资料中包含了引用来源，所以我们知道资料是否是来自 user 文件夹
         1. 如果是来自 user 文件夹，那么可以直接读取文件，对内容进行更新
         1. 如果内容不是来自 user（来自 context7），因为我们不能修改 context7 文件夹的内容，所以我们需要在 user 文件夹下创建一个新的`.md`文件来写入知识
      1. 添加完成后，因为下一次执行 search 的时候，会自动根据 fast-hash 去判断是否要重新构建或者更新索引，所以我们可以确保可以 search 出最新的知识内容。

---

**具体流程**：

- 首先，本项目是一个nodejs项目，目的是提供“可靠工具”（可以理解成CLI工具，下文简称 cli）
- 如果有源代码，那么可以用npmlink的方式来挂载，方便本地测试。
- 本项目可以通过 npx 来下载运行“可靠工具”

1. 首先使用`cli init`来往目录`~/.claude/agents/`来安装对应的subagents
2. 接下来，我们需要让subagents来按照以下的流程来进行工作：
   1. 根据用户的需求，通过`cli search`来搜索可能的包，如果存在混淆，那么就需要列出可能的列表，询问用户到底是哪个npm包
      1. 实现上，可以使用 `npm search "KEY WORDS"` 来进行搜索
   2. 如果用户没有明确的说明，就需要询问用户到底是要在当前项目文件夹（`./.claude/skills/`）或者用户目录(`~/.claude/skills`) 去创建 skill
   3. 参考`doc-downloader.md`的文档标准，创建对应的 skill-name。这里可以通过`cli get-name @package/name`来直接获得skill-name：
      1. 通过执行 `npm info @package/name version` 来获得版本号
      2. 然后根据规则拼接出 skill-name
   4. 创建出 `.claude/skills/{skill-name}` 文件夹后。还需要继续运行可靠工具，这里需要让 subagents 去调用 mcp-context7 来搜索相关的文档，具体参考`doc-downloader.md`
   5. 在Context7中找到project-id后，我们就要调用 `cli --dir=skill_dir download-context7 project-id`去下载的文档，并根据规范进行切分。存放到`{skill_dir}/assets/references/context7/*.md`
   6. 有了md文件，我们就可以通过`cli --dir=skill_dir search "Key Words"`来搜索文档。这时候的流程就是上文提到的，自动建立索引的工作
   7. 我们还要让subagents知道，以后可以用`cli --dir=skill_dir addSkill`来添加user文档
   8. 我们还要让subagents知道，以后可以用`cli --dir=skill_dir download-context7 project-id --force`强制更新文档

---

**工作内容**：

1. 请你根据"具体流程"，确定每一个工具都通过了测试。
2. 如果通过了测试，请自己尝试验证整个流程是否符合预期地工作。
3. 最后请你清理无关的代码文件。进行git提交
