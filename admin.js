// admin.js
// 针对免服务器架构深度改造：全部对接 GitHub REST API。
// 包括直接操作 config.json（存放专栏、资料、文章附属属性）以及 markdown 文件的生成

const GITHUB_USERNAME = "faderaljim";
const GITHUB_REPO = "ustc-homepage";

// 保存全局拉取下来的 config 数据镜像
let remoteConfig = {
    profile: { name: "", resume: "", hobbies: "", other: "" },
    categories: [],
    blogMeta: {} // 用于拉取 md 文件名后，匹配其所处分类、浏览量、喜欢等元数据。如: { "流形扫描探讨.md": {categoryId: 1, views: 0, likes: 0} }
};
let configSha = null; // 在每次获取 config 成功后储存其 SHA 用于更新提交

document.addEventListener("DOMContentLoaded", () => {
    const savedToken = sessionStorage.getItem("gh_token");
    if (savedToken) {
        document.getElementById("gh-token").value = savedToken;
    }
});

function utf8ToBase64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(str) {
    return decodeURIComponent(escape(window.atob(str)));
}

async function fetchWithAuth(url, method = 'GET', body = null) {
    const token = document.getElementById("gh-token").value.trim();
    const options = {
        method,
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    return fetch(url, options);
}

// 登录并加载所有的设置
async function initAdmin() {
    const token = document.getElementById("gh-token").value.trim();
    if (!token) {
        document.getElementById("load-msg").textContent = "Token不能为空";
        return;
    }
    sessionStorage.setItem("gh_token", token);
    const btn = document.getElementById("init-btn");
    btn.disabled = true;
    btn.textContent = "Loading...";

    try {
        // 请求 config.json 保证全局状态
        const configUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/config.json`;
        const res = await fetchWithAuth(configUrl);
        if (res.ok) {
            const data = await res.json();
            configSha = data.sha;
            remoteConfig = JSON.parse(base64ToUtf8(data.content));
            console.log("Config loaded:", remoteConfig);
        } else if (res.status === 404) {
            console.log("config.json 不存在，将使用缺省实例并在后续操作首飞");
        } else {
            throw new Error(`认证或获取配置失败: ${res.status}`);
        }

        // 渲染基础 UI
        document.getElementById("auth-section").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";

        // 将读取到的 profile 载入 DOM
        document.getElementById("edit-name").value = remoteConfig.profile.name || "";
        document.getElementById("edit-resume").value = remoteConfig.profile.resume || "";
        document.getElementById("edit-hobbies").value = remoteConfig.profile.hobbies || "";
        document.getElementById("edit-other").value = remoteConfig.profile.other || "";

        renderCategories();
        await loadArticlesAndMergeMeta();

    } catch (e) {
        document.getElementById("load-msg").textContent = e.message;
        btn.disabled = false;
        btn.textContent = "联网认证加载";
    }
}

// ============== 全局管理 Config 的 UI 交互阶段 ==============

function syncProfileToObj() {
    remoteConfig.profile.name = document.getElementById("edit-name").value.trim();
    remoteConfig.profile.resume = document.getElementById("edit-resume").value.trim();
    remoteConfig.profile.hobbies = document.getElementById("edit-hobbies").value.trim();
    remoteConfig.profile.other = document.getElementById("edit-other").value.trim();
    alert("卡片暂存成功！确认修改完毕后，请记得点击上方绿色“同步发布”按钮。");
}

function renderCategories() {
    if(!remoteConfig.categories) remoteConfig.categories = [];
    const ul = document.getElementById("category-list");
    ul.innerHTML = "";
    remoteConfig.categories.forEach(c => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center bg-gray-50 px-3 py-1 rounded";
        li.innerHTML = `<span>${c.name}</span> <button onclick="delCategory(${c.id})" class="text-red-500 hover:underline">删除</button>`;
        ul.appendChild(li);
    });
}
function addCategory() {
    const input = document.getElementById("new-category");
    const val = input.value.trim();
    if(val) {
        if(!remoteConfig.categories) remoteConfig.categories = [];
        remoteConfig.categories.push({ id: Date.now(), name: val });
        input.value = "";
        renderCategories();
        // 需重新渲染文章下拉框
        loadArticlesAndMergeMeta();
    }
}
function delCategory(id) {
    remoteConfig.categories = remoteConfig.categories.filter(c => c.id !== id);
    // 重置拥有此类的文章
    if(remoteConfig.blogMeta) {
        Object.keys(remoteConfig.blogMeta).forEach(fname => {
            if(remoteConfig.blogMeta[fname].categoryId == id) {
                remoteConfig.blogMeta[fname].categoryId = null;
            }
        });
    }
    renderCategories();
    loadArticlesAndMergeMeta();
}

// 统一写入 config.json （包括资料、专栏和文章Meta被改动后的确认）
async function saveRemoteConfig() {
    const btn = document.getElementById("save-config-btn");
    btn.disabled = true;
    btn.textContent = "Saving...";

    // Ensure Profile is synced just in case
    remoteConfig.profile.name = document.getElementById("edit-name").value.trim();
    remoteConfig.profile.resume = document.getElementById("edit-resume").value.trim();
    remoteConfig.profile.hobbies = document.getElementById("edit-hobbies").value.trim();
    remoteConfig.profile.other = document.getElementById("edit-other").value.trim();

    const configUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/config.json`;
    const commitData = {
        message: "Update global layout config",
        content: utf8ToBase64(JSON.stringify(remoteConfig, null, 2))
    };
    if (configSha) commitData.sha = configSha;

    try {
        const res = await fetchWithAuth(configUrl, 'PUT', commitData);
        if (res.ok) {
            const data = await res.json();
            configSha = data.content.sha;
            alert("全局配置同步成功！");
        } else {
            throw new Error(`配置写入失败: ${res.status}`);
        }
    } catch(e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "同步发布全局配置至 GitHub";
    }
}


// ============== 针对文章 Markdown （新建与挂载附属资料）操作阶段 ==============

async function loadArticlesAndMergeMeta() {
    const tbody = document.getElementById("article-manage-list");
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2 text-gray-500 italic">正在拉取 Markdown 实体文件...</td></tr>`;

    try {
        const filesUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/blogs/`;
        let res = await fetchWithAuth(filesUrl);
        let files = [];
        if (res.ok) files = await res.json(); // maybe empty array
        else if (res.status !== 404) throw new Error("获取文件列表失败");

        const mdFiles = files.filter(f => f.name.endsWith('.md'));
        tbody.innerHTML = "";

        if(mdFiles.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2 text-gray-500 italic">暂无文件实体</td></tr>`;
            return;
        }
        
        if(!remoteConfig.blogMeta) remoteConfig.blogMeta = {};

        // 生成分类的 option 字符串
        let catOptions = `<option value="">--无--</option>`;
        if(remoteConfig.categories) {
            remoteConfig.categories.forEach(c => {
                catOptions += `<option value="${c.id}">${c.name}</option>`;
            });
        }

        mdFiles.forEach(f => {
            const fName = f.name;
            // 为它在 config 对象里建个槽位
            if(!remoteConfig.blogMeta[fName]) {
                remoteConfig.blogMeta[fName] = { categoryId: null, views: 0, likes: 0 };
            }
            const meta = remoteConfig.blogMeta[fName];

            const tr = document.createElement("tr");
            tr.className = "border-b hover:bg-gray-50";
            // url encode file name for safe string passing
            const safeName = encodeURIComponent(fName);
            tr.innerHTML = `
                <td class="py-2 px-4 font-mono text-xs">${fName}</td>
                <td class="py-2 px-4">
                    <select class="border p-1 w-full text-xs rounded" onchange="updateMetaCat('${fName}', this.value)">
                        ${catOptions}
                    </select>
                </td>
                <td class="py-2 px-4 text-center space-x-2">
                    <button onclick="editArticle('${f.sha}', '${safeName}')" class="text-blue-600 hover:underline">编辑</button>
                    <button onclick="deleteArticle('${f.sha}', '${safeName}')" class="text-red-600 hover:underline">删除</button>
                </td>
            `;
            tbody.appendChild(tr);
            
            // Set Select value
            const sel = tr.querySelector("select");
            sel.value = meta.categoryId || "";
        });

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-2 text-red-500 italic">${e.message}</td></tr>`;
    }
}

function updateMetaCat(fName, newCatId) {
    if(!remoteConfig.blogMeta) remoteConfig.blogMeta = {};
    remoteConfig.blogMeta[fName].categoryId = newCatId ? parseInt(newCatId) : null;
    document.getElementById("save-config-btn").classList.add("animate-pulse"); // 提示需要保存
}

// ========================== 文章 Markdown 删除与提取功能 ==========================

async function deleteArticle(sha, encodedName) {
    const fName = decodeURIComponent(encodedName);
    if(!confirm(`⚠️ 警告: 确定要从 Github 仓库中直接删除文件 [${fName}] 吗？`)) return;

    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/blogs/${fName}`;
    const token = document.getElementById("gh-token").value;
    
    try {
        const res = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete article: ${fName}`,
                sha: sha
            })
        });

        if (res.ok) {
            alert(`已彻底删除文件 ${fName}`);
            // 清理 config 中的 meta
            if(remoteConfig.blogMeta && remoteConfig.blogMeta[fName]) {
                delete remoteConfig.blogMeta[fName];
                document.getElementById("save-config-btn").classList.add("animate-pulse"); // 提醒用户保存配置
            }
            loadArticlesAndMergeMeta();
        } else {
            throw new Error(`删除失败: ${res.status}`);
        }
    } catch(e) {
        alert(e.message);
    }
}

async function editArticle(sha, encodedName) {
    const fName = decodeURIComponent(encodedName);
    const titleInput = document.getElementById("post-title");
    const contentArea = document.getElementById("post-content");
    const shaInput = document.getElementById("post-sha");

    titleInput.value = "加载中...";
    contentArea.value = "正在从 Github 获取源文件内容...";
    shaInput.value = sha;
    
    document.getElementById("editor-section").scrollIntoView({ behavior: 'smooth' });

    try {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/blogs/${fName}`;
        const res = await fetchWithAuth(url);
        if(!res.ok) throw new Error("获取文件失败");
        
        const data = await res.json();
        titleInput.value = fName.replace('.md', '');
        titleInput.readOnly = true; // 编辑时不许改主键名
        titleInput.classList.add("bg-gray-100");
        contentArea.value = base64ToUtf8(data.content);
        
        document.getElementById("status-msg").textContent = `正在编辑: ${fName}`;
        document.getElementById("status-msg").className = "text-xs text-blue-500 ml-4";
    } catch(e) {
        alert(e.message);
        resetEditor();
    }
}

function resetEditor() {
    document.getElementById("post-title").value = "";
    document.getElementById("post-title").readOnly = false;
    document.getElementById("post-title").classList.remove("bg-gray-100");
    document.getElementById("post-content").value = "";
    document.getElementById("post-sha").value = "";
    document.getElementById("status-msg").textContent = "已切换为新建文章模式。";
    document.getElementById("status-msg").className = "text-xs text-green-600 ml-4";
}

// ========================== 编辑器富文本插入辅助功能 ==========================

function insertToEditor(text) {
    const el = document.getElementById("post-content");
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
    el.focus();
    el.selectionEnd = start + text.length;
}

function insertInnerLink() {
    let url = prompt("输入内部链接URL (如 article.html?file=xxx.md):");
    let text = prompt("输入显示中文字符:");
    if(url && text) {
        insertToEditor(`<a href="${url}" style="color: #0056b3; text-decoration: underline;">${text}</a>`);
    }
}

function insertOuterLink() {
    let url = prompt("输入外部链接URL (以 http/https 开头):", "https://");
    let text = prompt("输入外部网站名称 (中文字符):");
    if(url && text) {
        // 要求：外部网站超链接能够由我编辑外部网站的中文名，并且点击该标蓝的中文名可以重定向到该外部网站，显示仍然是标蓝的中文名，但外部网站需要额外加粗并斜体。
        insertToEditor(`<a href="${url}" target="_blank" style="color: #0056b3; text-decoration: underline; font-weight: bold; font-style: italic;">${text}</a>`);
    }
}

function insertImage() {
    let url = prompt("输入图片URL (如果是本地图片请先上传到Github通过图床链接引入):", "https://...");
    if(url) {
        insertToEditor(`\n<img src="${url}" alt="image" style="max-width:100%; border-radius:4px; margin:10px 0;" />\n`);
    }
}

function insertTable() {
    let cols = prompt("输入列数:", "3");
    if(cols && !isNaN(cols)) {
        let ths = Array.from({length: cols}).map(() => "<th>Header</th>").join("");
        let tds = Array.from({length: cols}).map(() => "<td>Data</td>").join("");
        let table = `\n| ${Array.from({length:cols}).map(()=>"Header").join(" | ")} |\n| ${Array.from({length:cols}).map(()=>"---").join(" | ")} |\n| ${Array.from({length:cols}).map(()=>"Data").join(" | ")} |\n`;
        insertToEditor(table);
    }
}

function insertFormula() {
    let f = prompt("输入 LaTeX 数学公式:");
    if(f) {
        insertToEditor(`\n$$ ${f} $$\n`);
    }
}

// 独立的发表 Markdown 功能代码
async function publishPost() {
    let title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const btn = document.getElementById("publish-btn");
    const msg = document.getElementById("status-msg");

    if (!title || !content) return alert("标题和内容皆不能为空");

    let filename = title.replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '') + '.md';
    const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/blogs/${filename}`;

    btn.disabled = true;
    btn.textContent = "Writing File...";
    msg.textContent = "正在提交 Markdown...";
    msg.className = "text-xs text-blue-600 font-bold ml-4";
    
    // 获取当前是否有预设的 SHA（代表覆盖编辑）
    let fileSha = document.getElementById("post-sha").value.trim();
    if (!fileSha) {
        // 如果没有，再去保险检测一次同名文件防止冲突
        try {
            const checkRes = await fetchWithAuth(apiUrl);
            if (checkRes.ok) fileSha = (await checkRes.json()).sha;
        } catch(e){}
    }

    const commitData = {
        message: `Create/Update article: ${title}`,
        content: utf8ToBase64(content)
    };
    if (fileSha) commitData.sha = fileSha;

    try {
        const res = await fetchWithAuth(apiUrl, 'PUT', commitData);
        if (res.ok) {
            msg.textContent = "✔ 文章已成功写回 Github 仓库！";
            msg.className = "text-xs text-green-600 font-bold ml-4";
            resetEditor(); // 完成后归位编辑器
            // 写入完毕后自动刷新列表，显示在其上的文章管理表单里
            loadArticlesAndMergeMeta();
        } else { 
            const errorResult = await res.json();
            throw new Error(errorResult.message || 'API Return Non-200'); 
        }
    } catch(e) {
        msg.textContent = '❌ ' + e.message;
        msg.className = "text-xs text-red-600 font-bold ml-4";
    } finally {
        btn.disabled = false;
        btn.textContent = "向仓库存入 Markdown";
    }
}
