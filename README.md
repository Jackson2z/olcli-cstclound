# olcli-cstcloud — 中国科技云 Overleaf 命令行工具

**基于 [aloth/olcli](https://github.com/aloth/olcli) 的定制 fork**，默认适配[中国科技云论文协同编辑服务](https://latex.cstcloud.cn)，开箱即用，无需手动配置 base URL 和 cookie 名。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 与上游 olcli 的区别

| 项目 | 上游 olcli | olcli-cstcloud |
|------|-----------|---------------|
| 默认 base URL | `https://www.overleaf.com` | `https://latex.cstcloud.cn` |
| 默认 cookie 名 | `overleaf_session2` | `overleaf.sid` |
| 编译/下载超时 | 10s | **240s**（适配大型项目） |

上游所有功能（pull/push/sync/compile/comments/ignore）完全保留，仅默认值改动。

## 安装

### 从源码构建

```bash
git clone https://github.com/Jackson2z/olcli-cstclound.git
cd olcli-cstclound
npm install
npm run build
```

构建后通过 `node dist/cli.js` 调用：

```bash
node dist/cli.js whoami
node dist/cli.js list
```

### 依赖

- Node.js >= 18

## 快速开始

### 1. 鉴权

在浏览器登录 https://latex.cstcloud.cn 后，从 DevTools 获取 cookie：

1. 打开浏览器开发者工具（F12）→ 应用 → Cookie
2. 复制 `overleaf.sid` 的值

```bash
node dist/cli.js auth --cookie "s%3A你的cookie值..."
```

验证登录状态：

```bash
node dist/cli.js whoami
```

**提示**：cookie 通常可保持数周有效。认证失败时重新获取即可。

### 2. 列出项目

```bash
node dist/cli.js list
```

### 3. 拉取项目到本地

```bash
node dist/cli.js pull "项目名"
cd 项目名/
```

### 4. 本地编辑 + 推送到远端

```bash
# 本地编辑
vim main.tex

# 推送改动
node dist/cli.js push

# 或双向同步（先拉再推）
node dist/cli.js sync
```

协作者在网页端的修改会通过 sync 自动拉取。

### 5. 远端编译

```bash
node dist/cli.js compile
```

触发 cstcloud 远端编译并输出 PDF URL。大项目（含多张 figure PDF）编译可能需要 1-2 分钟。

如需自动下载 PDF（超时 240s）：

```bash
node dist/cli.js pdf -o paper.pdf
```

## 全部命令

所有命令在含 `.olcli.json` 的同步目录下运行时自动识别项目。

| 命令 | 说明 |
|------|------|
| `auth` | 设置 session cookie |
| `whoami` | 检查认证状态 |
| `logout` | 清除凭据 |
| `list` | 列出全部项目 |
| `info [项目]` | 查看项目详情和文件列表 |
| `pull [项目] [目录]` | 拉取项目文件到本地 |
| `push [目录]` | 推送本地改动到远端 |
| `sync [目录]` | 双向同步（pull + push） |
| `upload <文件> [项目]` | 上传单个文件 |
| `download <文件> [项目]` | 下载单个文件 |
| `delete <文件> [项目]` | 删除远端文件/文件夹（别名 `rm`） |
| `rename <旧名> <新名> [项目]` | 重命名远端文件/文件夹（别名 `mv`） |
| `compile [项目]` | 触发 PDF 编译 |
| `pdf [项目]` | 编译并下载 PDF |
| `output [类型]` | 下载编译产物（`.bbl`, `.log`, `.aux` 等） |
| `zip [项目]` | 下载项目 zip 归档 |
| `comments list [项目]` | 列出审阅批注 |
| `comments add <文件> <消息> [项目]` | 添加批注 |
| `comments resolve <threadId> [项目]` | 解决批注 |
| `comments reopen <threadId> [项目]` | 重新打开批注 |
| `comments delete <threadId> [项目]` | 删除批注 |
| `ignored [目录]` | 列出当前生效的忽略规则 |
| `check` | 显示配置路径和凭据来源 |

### 全局选项

| 选项 | 说明 |
|------|------|
| `--verbose` | 将每个 HTTP 请求/响应输出到 stderr，用于调试 |
| `--base-url <URL>` | 覆盖实例地址（环境变量 `OVERLEAF_BASE_URL`） |
| `--cookie-name <名称>` | 覆盖 cookie 名称（环境变量 `OVERLEAF_COOKIE_NAME`） |

## 同步行为

### Pull
- 下载远端全部文件
- **跳过**上次 pull 后本地修改过的文件（不覆盖本地改动）
- 使用 `--force` 强制覆盖

### Push
- 上传上次 pull 后修改过的文件
- 保留嵌套文件夹结构
- 自动过滤 LaTeX 编译产物（见 [忽略规则](#忽略规则)）
- `--all` 上传全部文件
- `--dry-run` 预览变更
- `--show-ignored` 显示被过滤的文件

### Sync
- 先拉取远端改动，再推送本地改动
- 本地文件更新则保留本地版本
- **传播本地删除到远端** — 本地删除的文件在下次 sync 时从远端删除（`--no-delete` 可关闭）
- `--dry-run` 预览

### 删除传播机制

每次 sync，olcli 在 `.olcli.json` 中记录远端文件清单。下次 sync 时对比清单与本地文件树：

- 本地缺失 + 远端存在 → 远端删除
- 本地新增 → 上传
- 本地修改（晚于上次 pull）→ 上传
- 远端新增 → 下载

首次 sync 时跳过删除阶段（无清单可对比）。

## 忽略规则

上传前自动过滤本地文件，保持远端项目干净。

### 三层过滤

| 层级 | 文件 | 用途 |
|------|------|------|
| 1 | 内置规则 | LaTeX 中间产物（`.aux`, `.bbl`, `.log`, `.fls`, `.synctex.gz`）、OS 垃圾（`.DS_Store`, `Thumbs.db`）、构建目录（`build/`, `out/`）。`--no-default-ignore` 可关闭。 |
| 2 | `.olignore` | 项目级规则，gitignore 语法。建议与 `.tex` 一起提交。 |
| 3 | `.olignore.local` | 本机特定规则，加入 `.gitignore`。 |

### 特殊 PDF 规则

`X.pdf` 仅在同一文件夹存在 `X.tex`（或 `.ltx`）时被忽略。因此 `thesis.pdf`（旁边有 `thesis.tex`）会被过滤，而 `figures/diagram.pdf` 会正常同步。

### 示例 `.olignore`

```gitignore
# 编译产物
*.aux
*.log
*.out
*.toc
*.synctex.gz
*.fls
*.fdb_latexmk
*.bbl
*.blg
main.pdf
supplementary.pdf

# latex-sync 元数据
.latex-sync/
```

### 检查和覆盖

```bash
node dist/cli.js ignored                  # 列出当前规则
node dist/cli.js push --show-ignored      # 查看被跳过的文件
node dist/cli.js sync --no-default-ignore # 仅 .olignore 生效
node dist/cli.js sync --no-ignore         # 上传所有文件
```

## 凭据存储

按以下顺序查找凭据：

1. `OVERLEAF_SESSION` 环境变量
2. 当前目录 `.olauth` 文件
3. 全局配置：`~/.config/olcli-nodejs/config.json`

### .olauth 文件

项目级凭据，在项目目录下创建：

```
overleaf.sid=s%3A你的cookie值...
```

## 典型用例

### 本地编辑 + 远端编译

```bash
node dist/cli.js pull "论文项目"
cd 论文项目/
vim sections/01_introduction.tex
node dist/cli.js push
node dist/cli.js compile    # 输出 PDF URL
```

### Git 版本控制 + 远端同步

```bash
node dist/cli.js pull "我的论文" thesis
cd thesis
git init && git add . && git commit -m "从 Overleaf 导入"

# 日常工作流
vim main.tex
git commit -am "修改引言"
node dist/cli.js sync       # 与远端同步
```

### arXiv 提交

```bash
cd my-paper
node dist/cli.js output bbl -o main.bbl
node dist/cli.js zip -o arxiv-submission.zip
```

## 故障排查

### 会话过期

认证失败时，重新从浏览器获取 `overleaf.sid` cookie：

```bash
node dist/cli.js auth --cookie "新的cookie值"
```

### 编译失败

检查网页端编辑器的详细错误日志，常见原因：
- 缺少宏包
- `.tex` 语法错误
- 缺少参考文献文件

### 编译超时

大型项目（含多张高分辨率 figure PDF）编译可能超过 240s。使用 `compile` 命令（仅触发编译，返回 PDF URL），然后在浏览器中打开 URL 下载。

## 许可证

MIT © [Alexander Loth](https://alexloth.com)（上游作者）

本 fork 遵循 MIT 许可证。
