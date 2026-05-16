// admin.js
// 这是专门用于对接 GitHub API 直接编写并发布 Markdown 内容的逻辑。

// ================ 【用户配置区】 ================
// 请将此处的用户名替换为您的真实 GitHub 用户名。
// 根据您的主页链接 https://faderaljim.github.io/ustc-homepage/index.html，您的用户名是：
const GITHUB_USERNAME = "faderaljim";
const GITHUB_REPO = "ustc-homepage";
// ===============================================

// 页面加载时恢复之前可能填过的 Token（仅在当前窗口生命周期内存活）
document.addEventListener("DOMContentLoaded", () => {
    const savedToken = sessionStorage.getItem("gh_token");
    if (savedToken) {
        document.getElementById("gh-token").value = savedToken;
    }
});

// 支持中文 UTF-8 解析的安全 Base64 编码函数
// 规避原生 btoa() 直接编码中文字符导致的报错 ("The string to be encoded contains characters outside of the Latin1 range.")
function utf8ToBase64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}

async function publishPost() {
    const token = document.getElementById("gh-token").value.trim();
    let title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const btn = document.getElementById("publish-btn");
    const msg = document.getElementById("status-msg");

    if (!token) {
        alert("错误：必须提供 GitHub Personal Access Token 才能进行发布。");
        return;
    }
    if (!title) {
        alert("错误：文章标题不能为空。");
        return;
    }
    if (!content) {
        alert("错误：Markdown 正文不能为空。");
        return;
    }

    // 保存Token到session，避免刷新后重新手填
    sessionStorage.setItem("gh_token", token);

    // 格式化文件名，将空格等替换为 - 并追加 .md
    let filename = title.replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '') + '.md';

    // 构建 GitHub API URL
    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/blogs/${filename}`;

    btn.disabled = true;
    btn.textContent = "发布中...";
    msg.textContent = "正在尝试向 GitHub 仓库提交...";
    msg.className = "text-xs text-blue-600 font-bold";

    // 第一步：要处理覆盖更新还是新建。我们先查询该文件是否已存在以获取它的 SHA
    let fileSha = null;
    try {
        const checkRes = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (checkRes.ok) {
            const fileData = await checkRes.json();
            fileSha = fileData.sha;
        }
    } catch (e) {
        // 请求失败或是新建文件（404）都无所谓，继续进行发布
    }

    // 第二步：执行提交 (PUT)
    const commitData = {
        message: `Auto-publish: ${title}`,
        content: utf8ToBase64(content)
    };
    if (fileSha) {
        commitData.sha = fileSha; // 如果文件已存在，必须要传入原有文件的 SHA 否则报错
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(commitData)
        });

        if (response.ok) {
            msg.textContent = "🎉 发布成功！稍等大约一分钟后，静态页面将自动更新。";
            msg.className = "text-xs text-green-600 font-bold";
            alert("文章发布成功！");
            
            // 清理表单
            document.getElementById("post-title").value = "";
            document.getElementById("post-content").value = "";
        } else {
            const errData = await response.json();
            throw new Error(errData.message || "未知错误");
        }
    } catch (error) {
        msg.textContent = "❌ 发布失败";
        msg.className = "text-xs text-red-600 font-bold";
        alert(`提交失败，请检查 Token 权限 (需要 repo 权限) 或网络状态。\n错误信息: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = "提交发布";
    }
}
