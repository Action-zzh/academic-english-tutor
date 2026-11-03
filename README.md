# academic-english-tutor

## 英语科技论文阅读与写作

用于学术英语课堂的静态网站：简单访问密码入口、47 页课件、约 8 分钟的智能教师英文讲解、中英对照稿，以及魔珐星云实时数字人问答。

版本：2026-11-03.3。网站标签页与页面标题均为“英语科技论文阅读与写作”。

开启 GitHub Pages 后的网站地址：

https://action-zzh.github.io/academic-english-tutor/

## 开启 GitHub Pages

1. 在本仓库打开 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
3. 选择分支 **main**，文件夹 **/(root)**，点击 **Save**。
4. 等待 Pages 部署完成；以该设置页显示的 **Visit site** 地址为准。

本仓库已提供 `.nojekyll`，直接发布根目录的 HTML、CSS、JavaScript 和资源，不需要安装依赖或运行构建命令。网页内的本地资源均使用相对路径，兼容项目子目录地址。

## 使用方式

- 输入分享者提供的课堂访问密码即可查看课件和中英讲稿，不需要 GitHub 或 ChatGPT 账号。
- 访问通过后，在当前标签页会话内无需重复输入；新开标签页通常需要再次输入。是否恢复会话取决于浏览器。
- **访问密码只是前端跳转门槛，不是安全鉴权。** 本仓库和静态资源仍是公开的，熟悉开发工具的人可以绕过，不能用于保护密钥、个人信息或机密材料。
- 实时数字人需要访问者自行提供有效的星云 App ID 和 App Secret，并具备可用额度、联网环境和浏览器 WebGL2 支持。
- 凭据仅在当前页面内存中使用，不保存到浏览器存储，不上传到本仓库。浏览器端 SDK 能读取凭据，这不是生产级密钥隐藏方案。
- **不要把实际密钥、令牌、账号配置文件或包含密钥的截图提交到仓库。**
- 离线课件和讲稿可作为备用；实时数字人不是离线运行，课堂前应保留本地启动包和本人录制的演示视频。
- GitHub Pages 的国内访问效果取决于实际网络，请在课堂电脑和校园网提前测试。

## 内容与来源

- `index.html`、`access.css`、`access.js`：简单密码入口；只在会话存储中保留通过标记，不保存输入的原始密码。此标记与星云应用凭据无关。
- `classroom.html`：课堂页面，带前端会话检查。
- `assets/slides/`：原课件全部 47 页的页面图像与缩略图。
- `materials/lecture-bilingual.txt`：与网页播报一致的中英对照稿。
- `materials/teacher-slides.pptx`：原始可编辑课件；作者 Men Xiangchi，Foreign Studies College，Northeastern University，课件日期 August 23rd, 2025。
- `third-party/`：复用提示词的来源与许可。数字人适配参考星云官方文档，界面与流程参考项目见网站“帮助”。

配套讲解是课件内容的精讲转述，不是原作者逐字稿。第三方材料保留原作者权利和各自许可；公开托管不表示所有材料均获得统一的开源授权。
