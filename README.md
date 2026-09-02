# AIMATEX-MUSIC

面向公众的独立音乐站：**搜得广、听得清、用得省心**。

前后端同仓（monorepo）。线上站点：

| 用途 | 地址 |
|------|------|
| 网页 | [music.aimatex.com](https://music.aimatex.com) |
| API | [music-api.aimatex.com](https://music-api.aimatex.com) |

同属 [AIMATEX](https://aimatex.com) 产品线的一员；本仓库只承载 **MUSIC** 产品本身。

---

## 目录

- [为什么做这个站](#为什么做这个站)
- [产品亮点](#产品亮点)
- [功能一览](#功能一览)
- [曲库与音质说明](#曲库与音质说明)
- [技术架构](#技术架构)
- [仓库结构](#仓库结构)
- [本地开发](#本地开发)
- [配置与密钥](#配置与密钥)
- [生产部署](#生产部署)
- [分支与协作](#分支与协作)
- [常见问题](#常见问题)

---

## 为什么做这个站

市面上的音乐 App 很全，但往往伴随着会员墙、广告和碎片化体验。AIMATEX-MUSIC 想做的是：

- **打开网页就能听**，不必再下一个客户端
- **免站点会员搜听**：用户不必在本站开通会员即可搜索与播放（曲库能力依赖服务端配置的源站账号）
- **尽量高清**：支持标准 / 较高 / 极高 / **无损** / **Hi-Res**，有源则优先清晰度
- **沉浸听歌**：全屏歌词与氛围，接近小型家庭 KTV 的听感
- **自己的歌单空间**：发现、收藏、歌单、私人 FM、上传，形成可长期使用的个人曲库

适合通勤、加班、深夜独处，或想把「好听的歌」认真收进自己歌单里的人。

---

## 产品亮点

| 亮点 | 说明 |
|------|------|
| 发现与搜索 | 对接网易云级别曲库检索，关键词即可找歌 |
| 高音质链路 | 优先 Hi-Res / 无损 FLAC，不可用时自动降级并记录实际音质 |
| 沉浸歌词 | 首页沉浸舞台、自动隐藏控件，更适合「只听」 |
| 歌单体系 | 自建歌单、喜欢、历史；歌单壁纸与听歌氛围可定制 |
| 协作听感 | 同歌单可感知在听状态（WebSocket） |
| 邀请制注册 | 邀请码注册，或提交注册申请由管理员审批并邮件通知 |
| 管理后台 | 用户、注册申请、留言、愿望单、豆子、开发者申请等 |

---

## 功能一览

### 听歌与曲库

- **发现音乐**：搜索、导入到个人曲库 / 歌单
- **歌单**：创建、编辑、壁纸、曲目管理
- **喜欢 / 历史**：常用入口一键回听
- **私人 FM**：随机发现向的听歌流
- **本地上传**：支持常见音频格式（含 FLAC 等），走对象存储
- **播放页**：封面、进度、音质标识、沉浸歌词舞台
- **导入富元数据**：音频、高清封面、原文/翻译/罗马音/逐字歌词、音质、歌手与专辑 ID、别名/译名、发行年、原始详情 JSON

### 账号与安全

- 登录 / 注册（邀请码）
- 无邀请码时提交 **注册申请**，管理员通过或拒绝后邮件告知
- 邮箱验证、找回密码
- 个人资料、隐私设置、多邀请码管理（管理员可生成邀请码）

### 站点其它模块

- 首页与沉浸听歌入口
- 开发日记、留言板、豆子（站点积分相关）
- `/admin` 管理后台（需管理员角色）

### 多语言

前端已接入 i18n（中文 / 日文等），界面文案可按语言包扩展。

---

## 曲库与音质说明

请用务实的预期理解「能搜到什么」：

1. **搜索范围** ≈ 网易云可检索曲库，覆盖面很大，但不是「全世界每一首歌」。
2. **能否播放** 取决于源站是否仍有可解析的播放地址：下架、版权、地区或账号权限可能导致搜得到却听不了，或音质降级。
3. **音质策略**：服务端按偏好依次尝试 `hires` → `lossless` → 更低档；入库时以**实际拿到的音质**为准，前端会展示对应徽章。
4. **本站用户侧**：不要求用户自备网易云会员；能力依赖部署环境里配置的 `MUSIC_U` 等凭证，且 Cookie 会过期，需要运维定期更新。

对外介绍时建议说：**曲库丰富、支持全无损及更高清晰度、免会员搜听**；避免承诺「什么歌都能搜到 / 一定无损」。

---

## 技术架构

```text
浏览器 (React + Vite)
        │
        ├─ HTTPS ─► music.aimatex.com     (Nginx 静态资源)
        │
        └─ HTTPS ─► music-api.aimatex.com (Nginx → Spring Boot :8882)
                              │
                              ├─ MySQL          业务数据
                              ├─ 腾讯云 COS     音频 / 封面等对象
                              ├─ 网易云 weapi   搜索与播放地址
                              └─ SMTP (QQ 等)   注册审批 / 验证邮件
```

| 层 | 技术 |
|----|------|
| 前端 | React 18、TypeScript、Vite、Tailwind CSS、React Router、i18next |
| 后端 | Java 17、Spring Boot 3.3、Spring Security、JPA、WebSocket |
| 数据 | MySQL（`utf8mb4`） |
| 存储 | 腾讯云 COS（可关，走本地上传目录） |
| 鉴权 | JWT（长有效期，配合前端滑动登出策略） |
| 部署 | Nginx + systemd；脚本见 `scripts/deploy_music_prod.py` |

前后端 **一个 Git 仓库**：改 API 与 UI 可同 PR 交付，历史完整保留。

---

## 仓库结构

```text
aimatex-music/
├── frontend/                 # Web 前端
│   ├── src/
│   │   ├── api/              # HTTP 客户端与类型
│   │   ├── components/       # UI 组件（播放器、歌词舞台、管理面板等）
│   │   ├── pages/            # 路由页面
│   │   ├── music/            # 音质、路由等听歌域逻辑
│   │   ├── i18n/             # 多语言文案
│   │   └── siteMeta.ts       # 品牌名、域名、友站链接
│   ├── package.json
│   └── vite.config.ts
├── src/main/java/.../        # Spring Boot 后端
│   ├── music/                # 歌单、曲目、网易云发现、上传
│   ├── auth/                 # 登录注册、邀请码、注册申请
│   └── ...                   # 留言、豆子、管理端等
├── src/main/resources/
│   └── application.yml       # 默认配置（密钥请用 env / secrets）
├── scripts/
│   ├── bendoudou.env.example # 密钥模板
│   └── deploy_music_prod.py  # 生产一键部署
├── secrets/                  # 本地密钥（已 gitignore，勿提交）
├── pom.xml
└── README.md
```

---

## 本地开发

### 环境要求

- **JDK 17+**
- **Maven 3.9+**（或 IDE 自带 Maven）
- **Node.js 18+**（建议 LTS）与 npm
- 可访问的 **MySQL**（库建议 `utf8mb4` / `utf8mb4_unicode_ci`）
- 可选：腾讯云 COS、网易云 Cookie、SMTP（发现音乐 / 邮件相关功能需要）

### 1. 克隆

```bash
git clone git@github.com:spacex-maker/aimatex-music.git
cd aimatex-music
```

默认分支为 **`main`**（当前产品主线）。

### 2. 后端

```bash
# 准备密钥（见下一节）
cp scripts/bendoudou.env.example secrets/bendoudou.env
# 编辑 secrets/bendoudou.env，填入真实值

# 按需修改 application.yml 中的数据源，或改用环境变量覆盖：
#   SPRING_DATASOURCE_URL / USERNAME / PASSWORD

mvn -DskipTests package
mvn spring-boot:run
```

默认 API 端口：**8882**。

`application.yml` 会通过：

```yaml
spring.config.import: optional:file:./secrets/bendoudou.env[.properties]
```

尝试加载本地密钥文件；没有该文件时相关能力会降级或不可用，但服务仍可启动（取决于你是否硬编码了数据源）。

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

开发服务器通常由 Vite 提供；请确认前端 API Base URL 指向本机 `8882` 或你的反向代理。生产构建：

```bash
npm run build
# 产物在 frontend/dist，由 Nginx 托管
```

### 4. 推荐自检清单

- [ ] 能打开登录页并完成注册 / 登录（邀请码或申请流）
- [ ] `/music` 下发现搜索可用（需网易云 Cookie）
- [ ] 导入后播放正常，音质徽章与预期一致
- [ ] 沉浸歌词舞台可进出
- [ ] 管理员账号可进 `/admin` 审批注册申请

---

## 配置与密钥

**原则：密钥永不进 Git。** `secrets/` 已在 `.gitignore` 中。

复制模板：

```bash
cp scripts/bendoudou.env.example secrets/bendoudou.env
```

常见变量：

| 变量 | 用途 |
|------|------|
| `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` | 腾讯云 COS |
| `BENDOUDOU_NETEASE_MUSIC_U` | 网易云 `MUSIC_U` Cookie |
| `BENDOUDOU_NETEASE_CSRF` | 网易云 CSRF |
| `SPRING_MAIL_USERNAME` / `SPRING_MAIL_PASSWORD` | SMTP（验证码、审批邮件） |
| `BENDOUDOU_JWT_SECRET` | JWT 签名（生产务必自定义） |
| `BENDOUDOU_MUSIC_UPLOAD` | 本地上传目录（相对运行目录） |

COS、邮件、网易云均可按环境启用；未配置时对应功能会返回明确错误信息（便于排查）。

> 若你从旧个人站迁来，会看到部分包名 / 配置键仍带 `bendoudou` 前缀，属于历史兼容命名，不影响产品品牌 **AIMATEX-MUSIC**。

---

## 生产部署

仓库内提供脚本：`scripts/deploy_music_prod.py`。

概要流程：

1. 本地构建后端 JAR、`frontend/dist`
2. SSH 上传至服务器约定目录
3. 写入远程 `bendoudou.env`（数据源、COS、网易云、邮件等）
4. 更新 Nginx（`music.aimatex.com` / `music-api.aimatex.com`）与 systemd 单元 `aimatex-music`
5. 重启服务并做健康检查

使用前请自行设置 SSH 与密钥环境变量（例如 `DEPLOY_SSH_USER`、`DEPLOY_SSH_PASSWORD`），**不要把口令写进仓库或 README**。

生产注意：

- 定期检查网易云 Cookie 是否失效（失效后表现为搜索 / 取链失败）
- 上传体积限制与 Nginx `client_max_body_size`、Spring multipart 上限保持一致
- JWT 与数据库口令使用强随机值，且仅存在于服务器 env

---

## 分支与协作

| 项 | 说明 |
|----|------|
| 默认分支 | `main` |
| 历史 | 自前序项目完整迁入，保留提交历史 |
| 建议工作流 | 从 `main` 拉功能分支 → PR → 合并回 `main` |

相关友站（非本仓）：AIMATEX、Seedance2、AI2Obj、OpenRobotX、OpenClaw4j 等，见前端 `siteMeta.ts`。

---

## 常见问题

**Q: 搜得到歌但播不了？**  
A: 多为源站无可用 URL、版权限制或 Cookie 失效。先查服务端日志与网易云凭证。

**Q: 为什么有的歌是「较高」不是「无损」？**  
A: 源站对该曲未提供更高档，或当前账号权限不足；系统会自动降级并以实际音质入库。

**Q: 没有邀请码怎么注册？**  
A: 登录页可提交注册申请；管理员在后台审批，通过 / 拒绝会发邮件。

**Q: 本地没有 COS 能不能跑？**  
A: 可以偏本地上传目录开发；发现音乐、邮件等仍依赖对应配置。

**Q: 和旧仓库 `bendoudoudounai` 什么关系？**  
A: 产品已独立为 `aimatex-music`。旧仓分支保持不动；本仓以 `main` 为唯一主线继续演进。

---

## 致谢

开发：[Anakki](https://aimatex.com) · 产品品牌：AIMATEX-MUSIC

若你在用这个站听歌、建歌单，或愿意反馈体验问题，都非常欢迎——独立站的意义，就是把「好听」认真地留给愿意留下来的人。
