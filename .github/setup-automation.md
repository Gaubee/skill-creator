# 自动发布配置指南

## 🚀 GitHub Action 自动发布 NPM 包

本项目已配置自动化发布流程，当 `package.json` 中的版本号发生变化时，会自动发布到 NPM。

## 📋 配置步骤

### 1. 获取 NPM Token

1. 登录 [NPM](https://www.npmjs.com/)
2. 进入 **Access Tokens** 页面：点击右上角头像 → **Account** → **Access Tokens**
3. 点击 **Generate New Token**
4. 选择 **Automation** 类型（推荐）或 **Publish**
5. 设置 Token 名称，例如：`skill-creator-github-action`
6. 复制生成的 Token（⚠️ 只显示一次）

### 2. 配置 GitHub Secrets

在 GitHub 仓库中配置 NPM Token：

1. 进入 GitHub 仓库页面
2. 点击 **Settings** 标签
3. 在左侧菜单中找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 添加以下 secret：

| Secret 名称 | 值 | 描述 |
|-------------|----|----- |
| `NPM_TOKEN` | 你的 NPM Automation Token | 用于发布包到 NPM |

### 3. 配置 GitHub Actions 权限

**重要**：为了能够推送 Git 标签和创建 Releases，需要配置适当的权限。

#### 方法一：在 Workflow 文件中配置（已配置）

本项目已在 `.github/workflows/release.yml` 中配置了必要权限：

```yaml
permissions:
  contents: write  # 允许推送标签和创建 Releases
```

#### 方法二：在仓库设置中配置（可选）

如果你想要更细粒度的控制，可以在仓库设置中配置：

1. 进入 GitHub 仓库页面
2. 点击 **Settings** 标签
3. 在左侧菜单中找到 **Actions** → **General**
4. 向下滚动找到 **Workflow permissions**
5. 选择 **Read and write permissions**
6. ✅ 勾选 **Allow GitHub Actions to create and approve pull requests**
7. 点击 **Save**

### 4. 确保仓库权限

确保你有以下权限：
- ✅ 推送代码到 `main` 分支的权限
- ✅ 管理 GitHub Secrets 的权限
- ✅ 创建 GitHub Releases 的权限
- ✅ 创建 Git Tags 的权限

## 🔧 工作流程

### 自动触发
- 当代码推送到 `main` 分支时自动触发
- 检查 `package.json` 版本是否已发布到 NPM
- 如果是新版本，自动运行测试并发布

### 手动触发
- 在 GitHub Actions 页面可以手动触发工作流
- 适用于重新发布或测试场景

### 发布步骤
1. **版本检查**：比较当前版本与 NPM 已发布版本
2. **运行测试**：执行所有测试和类型检查
3. **构建项目**：编译 TypeScript 代码
4. **创建 Git 标签**：自动创建版本标签
5. **发布到 NPM**：自动发布新版本
6. **创建 GitHub Release**：生成发布说明

## 📝 使用方法

### 发布新版本

1. 更新 `package.json` 中的版本号：
   ```bash
   # 补丁版本（修复 bug）
   npm version patch
   
   # 次要版本（新功能）
   npm version minor
   
   # 主要版本（破坏性变更）
   npm version major
   ```

2. 推送到 GitHub：
   ```bash
   git push origin main --tags
   ```

3. 等待 GitHub Action 完成
   - 在 Actions 页面查看进度
   - 成功后会自动创建 Git 标签和 GitHub Release
   - 包会发布到 NPM 注册表

### 检查发布状态

- **GitHub Actions**: 在仓库的 Actions 页面查看工作流状态
- **NPM**: 在 [NPM 包页面](https://www.npmjs.com/package/skill-creator) 查看已发布版本
- **GitHub Releases**: 在仓库的 Releases 页面查看发布记录

## ⚠️ 注意事项

### 版本号规范
- 遵循 [Semantic Versioning](https://semver.org/) 规范
- 使用 `npm version` 命令更新版本号（推荐）
- 不要重复使用已发布的版本号

### 测试要求
- 所有测试必须通过才能发布
- 类型检查必须通过
- 项目必须能成功构建

### 权限管理
- NPM Token 具有发布权限，请妥善保管
- 定期轮换 NPM Token 以提高安全性
- 不要在代码中硬编码任何敏感信息

## 🐛 故障排除

### 常见问题

**Q: Action 失败，提示 "Authentication failed"**
A: 检查 `NPM_TOKEN` 是否正确设置，确保 Token 没有过期

**Q: Action 失败，提示 "Permission to X.git denied to github-actions[bot]"**
A: 这是 GitHub Actions 权限问题，检查以下内容：
- 确认 `.github/workflows/release.yml` 文件顶部包含 `permissions: contents: write`
- 确认仓库的 Actions 权限设置为 "Read and write permissions"
- 确认你有推送标签的权限

**Q: 测试失败导致无法发布**
A: 在本地运行 `npm test` 确保所有测试通过，然后重新推送

**Q: 版本号已存在**
A: 使用 `npm version` 更新到新的版本号

**Q: 权限不足**
A: 确保你有推送标签和创建 Release 的权限

### 调试步骤

1. 查看 GitHub Actions 日志
2. 检查错误信息和警告
3. 在本地复现和修复问题
4. 重新推送代码触发工作流

## 📊 监控

建议设置以下监控：
- GitHub Actions 成功/失败通知
- NPM 下载量统计
- 依赖安全扫描

---

如有问题，请查看 [GitHub Actions 文档](https://docs.github.com/en/actions) 或 [NPM 文档](https://docs.npmjs.com/)。