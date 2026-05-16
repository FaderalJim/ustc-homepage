// data.js
const DEFAULT_PROFILE = {
    name: "",
    resume: "",
    hobbies: "",
    other: ""
};

const DEFAULT_BLOGS = [
    {
        id: 1,
        title: "流形扫描算法在动力系统中的局部轨迹跟踪",
        content: "<p>在处理高维复杂动力系统的参数演化与状态估计问题时，传统的全局降维或全状态空间重构方法往往面临“维数灾难”以及难以承受的计算成本。针对这一痛点，我们近期在流形扫描（Manifold Scanning）算法的框架下，深入探索了一种全新的轨迹跟踪范式。</p><h3>核心理念：局部跟踪而非全局重现</h3><p>本研究的核心思路在于“局部跟踪而非全局重现”...</p>",
        date: "2026-05-16",
        likes: 0,
        views: 0,
        categoryId: null,
        comments: []
    }
];

if (!localStorage.getItem('ustc_profile')) localStorage.setItem('ustc_profile', JSON.stringify(DEFAULT_PROFILE));
if (!localStorage.getItem('ustc_blogs')) localStorage.setItem('ustc_blogs', JSON.stringify(DEFAULT_BLOGS));
if (!localStorage.getItem('ustc_password')) localStorage.setItem('ustc_password', 'admin');
if (!localStorage.getItem('ustc_stats')) localStorage.setItem('ustc_stats', JSON.stringify({ visits: 0 }));
if (!localStorage.getItem('ustc_categories')) localStorage.setItem('ustc_categories', JSON.stringify([]));
if (!localStorage.getItem('ustc_guestbook')) localStorage.setItem('ustc_guestbook', JSON.stringify([]));

function getProfile() { return JSON.parse(localStorage.getItem('ustc_profile')); }
function saveProfile(profile) { localStorage.setItem('ustc_profile', JSON.stringify(profile)); }

function getPassword() { return localStorage.getItem('ustc_password'); }
function setPassword(pwd) { localStorage.setItem('ustc_password', pwd); }

function getStats() { return JSON.parse(localStorage.getItem('ustc_stats')); }
function incrementVisits() { 
    let s = getStats(); 
    s.visits = (s.visits || 0) + 1; 
    localStorage.setItem('ustc_stats', JSON.stringify(s)); 
}

function getCategories() { return JSON.parse(localStorage.getItem('ustc_categories')) || []; }
function saveCategory(cat) {
    let cats = getCategories();
    if(cat.id) {
        let idx = cats.findIndex(c => c.id == cat.id);
        if(idx > -1) cats[idx] = cat;
        else cats.push(cat);
    } else {
        cat.id = Date.now();
        cats.push(cat);
    }
    localStorage.setItem('ustc_categories', JSON.stringify(cats));
}
function deleteCategory(id) {
    let cats = getCategories().filter(c => c.id != id);
    localStorage.setItem('ustc_categories', JSON.stringify(cats));
    let blogs = getBlogs();
    blogs.forEach(b => { if(b.categoryId == id) b.categoryId = null; });
    localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
}

function getBlogs() { return JSON.parse(localStorage.getItem('ustc_blogs')) || []; }
function saveBlog(blog) {
    const blogs = getBlogs();
    if (blog.id) {
        const index = blogs.findIndex(b => b.id == blog.id);
        if (index > -1) {
            blog.likes = blogs[index].likes || 0;
            blog.views = blogs[index].views || 0;
            blog.comments = blogs[index].comments || [];
            blogs[index] = blog;
        } else {
            blogs.push(blog);
        }
    } else {
        blog.id = Date.now();
        if(!blog.date) blog.date = new Date().toISOString().split('T')[0];
        blog.likes = 0;
        blog.views = 0;
        blog.comments = [];
        blogs.push(blog);
    }
    localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
}
function deleteBlog(id) {
    let blogs = getBlogs().filter(b => b.id != id);
    localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
}
function getBlogById(id) { return getBlogs().find(b => b.id == id); }
function incrementBlogViews(id) {
    let blogs = getBlogs();
    let index = blogs.findIndex(b => b.id == id);
    if(index > -1) {
        blogs[index].views = (blogs[index].views || 0) + 1;
        localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
    }
}
function likeBlog(id) {
    let blogs = getBlogs();
    let index = blogs.findIndex(b => b.id == id);
    if(index > -1) {
        blogs[index].likes = (blogs[index].likes || 0) + 1;
        localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
    }
}
function addBlogComment(id, comment) {
    let blogs = getBlogs();
    let index = blogs.findIndex(b => b.id == id);
    if(index > -1) {
        if(!blogs[index].comments) blogs[index].comments = [];
        comment.id = Date.now();
        comment.date = new Date().toLocaleString();
        comment.reply = "";
        blogs[index].comments.push(comment);
        localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
    }
}
function replyBlogComment(blogId, commentId, replyText) {
    let blogs = getBlogs();
    let bIdx = blogs.findIndex(b => b.id == blogId);
    if(bIdx > -1) {
        let cIdx = blogs[bIdx].comments.findIndex(c => c.id == commentId);
        if(cIdx > -1) {
            blogs[bIdx].comments[cIdx].reply = replyText;
            localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
        }
    }
}
function deleteBlogComment(blogId, commentId) {
    let blogs = getBlogs();
    let bIdx = blogs.findIndex(b => b.id == blogId);
    if(bIdx > -1) {
        blogs[bIdx].comments = blogs[bIdx].comments.filter(c => c.id != commentId);
        localStorage.setItem('ustc_blogs', JSON.stringify(blogs));
    }
}

function getGuestbook() { return JSON.parse(localStorage.getItem('ustc_guestbook')) || []; }
function addGuestbook(msg) {
    let gb = getGuestbook();
    msg.id = Date.now();
    msg.date = new Date().toLocaleString();
    msg.reply = "";
    gb.push(msg);
    localStorage.setItem('ustc_guestbook', JSON.stringify(gb));
}
function deleteGuestbook(id) {
    let gb = getGuestbook().filter(m => m.id != id);
    localStorage.setItem('ustc_guestbook', JSON.stringify(gb));
}
function replyGuestbook(id, replyText) {
    let gb = getGuestbook();
    let idx = gb.findIndex(m => m.id == id);
    if(idx > -1) {
        gb[idx].reply = replyText;
        localStorage.setItem('ustc_guestbook', JSON.stringify(gb));
    }
}
