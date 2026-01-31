export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 路由分发 ---

    // 1. API 接口 (处理后台数据)
    if (path.startsWith('/api/')) {
      return handleApi(request, env);
    }

    // 2. 后台管理页面 (直接读取 admin.html)
    // 修改点：不再调用 handleAdmin()，而是读取静态文件
    if (path === '/admin') {
      return env.ASSETS.fetch(new URL('/admin.html', request.url));
    }

    // 3. 首页 (动态渲染)
    if (path === '/' || path === '/index.html') {
      return renderIndex(request, env);
    }

    // 4. 博客列表页 (全部文章)
    if (path === '/blog' || path === '/blog.html') {
      return renderBlogList(request, env);
    }

    // 5. 分类页
    if (path.startsWith('/category/')) {
        const categoryName = decodeURIComponent(path.split('/').pop());
        return renderCategory(request, env, categoryName);
    }

    // 6. 文章详情页
    if (path.startsWith('/article/')) {
        const id = path.split('/').pop();
        return renderSinglePost(request, env, id);
    }

    // 7. 静态资源 (CSS/JS/图片/admin.html等) 直接返回
    return env.ASSETS.fetch(request);
  }
};

// ================= 页面渲染逻辑 (保持不变) =================

async function renderIndex(request, env) {
  const response = await env.ASSETS.fetch(new URL('/index.html', request.url));
  const { results: posts } = await env.DB.prepare(
    "SELECT * FROM posts ORDER BY created_at DESC LIMIT 6"
  ).run();

  return new HTMLRewriter()
    .on('#recent-posts-container', {
      element(e) {
        let html = '';
        posts.forEach(post => {
          html += `
            <div class="col-lg-4">
                <div class="single-bottom mb-35">
                    <div class="trend-bottom-img mb-30">
                        <img src="${post.image}" alt="${post.title}" style="width:100%; height:200px; object-fit:cover; border-radius:5px;">
                    </div>
                    <div class="trend-bottom-cap">
                        <span class="color1">${post.category || '未分类'}</span>
                        <h4><a href="/article/${post.id}">${post.title}</a></h4>
                    </div>
                </div>
            </div>`;
        });
        e.setInnerContent(html, { html: true });
      }
    })
    .transform(response);
}

async function renderBlogList(request, env) {
    const response = await env.ASSETS.fetch(new URL('/blog.html', request.url));
    const { results: posts } = await env.DB.prepare("SELECT * FROM posts ORDER BY created_at DESC").run();

    return new HTMLRewriter()
        .on('#all-posts-container', {
            element(e) {
                let html = '';
                posts.forEach(post => {
                    html += `
                    <article class="blog_item">
                        <div class="blog_item_img">
                            <img class="card-img rounded-0" src="${post.image}" alt="" style="max-height:300px; object-fit:cover;">
                            <a href="/article/${post.id}" class="blog_item_date">
                                <h3>${new Date(post.created_at).getDate()}</h3>
                                <p>${new Date(post.created_at).getMonth() + 1}月</p>
                            </a>
                        </div>
                        <div class="blog_details">
                            <a class="d-inline-block" href="/article/${post.id}">
                                <h2>${post.title}</h2>
                            </a>
                            <p>${post.content.replace(/<[^>]+>/g, '').substring(0, 120)}...</p>
                            <ul class="blog-info-link">
                                <li><a href="/category/${post.category}"><i class="fa fa-user"></i> ${post.category}</a></li>
                            </ul>
                        </div>
                    </article>`;
                });
                e.setInnerContent(html, { html: true });
            }
        })
        .transform(response);
}

async function renderCategory(request, env, categoryName) {
    const response = await env.ASSETS.fetch(new URL('/categori.html', request.url));
    const { results: posts } = await env.DB.prepare("SELECT * FROM posts WHERE category = ? ORDER BY created_at DESC")
        .bind(categoryName).run();

    return new HTMLRewriter()
        .on('#category-posts-container', {
            element(e) {
                let html = '';
                if(posts.length === 0) html = '<div class="col-12"><p>该分类下暂无文章</p></div>';
                posts.forEach(post => {
                    html += `
                    <div class="col-lg-4 col-md-6">
                        <div class="single-bottom mb-35">
                            <div class="trend-bottom-img mb-30">
                                <img src="${post.image}" alt="" style="width:100%; height:200px; object-fit:cover;">
                            </div>
                            <div class="trend-bottom-cap">
                                <span class="color1">${post.category}</span>
                                <h4><a href="/article/${post.id}">${post.title}</a></h4>
                            </div>
                        </div>
                    </div>`;
                });
                e.setInnerContent(html, { html: true });
            }
        })
        .transform(response);
}

async function renderSinglePost(request, env, id) {
    const url = new URL(request.url);
    const templateUrl = new URL('/single-blog.html', url.origin);
    const response = await env.ASSETS.fetch(templateUrl);
    
    const post = await env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return new Response("文章不存在", { status: 404 });

    return new HTMLRewriter()
        .on('#post-title', { element(e) { e.setInnerContent(post.title); } })
        .on('#post-content', { element(e) { e.setInnerContent(post.content, { html: true }); } })
        .on('#post-category', { element(e) { e.setInnerContent(post.category || '默认'); } })
        .on('#post-image', { 
            element(e) { 
                if(post.image) {
                    e.setAttribute('src', post.image); 
                    e.removeAttribute('style');
                }
            } 
        })
        .transform(response);
}

// ================= API 逻辑 (保持不变) =================

async function handleApi(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === '/api/login') {
        const body = await request.json();
        const user = await env.DB.prepare("SELECT value FROM config WHERE key='admin_user'").first();
        const pass = await env.DB.prepare("SELECT value FROM config WHERE key='admin_pass'").first();
        
        if (body.username === user.value && body.password === pass.value) {
            return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }});
        }
        return new Response(JSON.stringify({ success: false }), { status: 401 });
    }

    if (url.pathname === '/api/config' && method === 'POST') {
        const body = await request.json();
        await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'github_user'").bind(body.gh_user).run();
        await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'github_repo'").bind(body.gh_repo).run();
        await env.DB.prepare("UPDATE config SET value = ? WHERE key = 'github_token'").bind(body.gh_token).run();
        return new Response("Config Saved");
    }

    if (url.pathname === '/api/upload' && method === 'POST') {
        const body = await request.json();
        const { fileName, content } = body;

        const user = await env.DB.prepare("SELECT value FROM config WHERE key='github_user'").first();
        const repo = await env.DB.prepare("SELECT value FROM config WHERE key='github_repo'").first();
        const token = await env.DB.prepare("SELECT value FROM config WHERE key='github_token'").first();

        const path = `images/${Date.now()}_${fileName}`;
        const ghUrl = `https://api.github.com/repos/${user.value}/${repo.value}/contents/${path}`;

        const ghRes = await fetch(ghUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token.value}`,
                'User-Agent': 'Cloudflare-Worker-Blog',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "upload image",
                content: content 
            })
        });

        if (!ghRes.ok) return new Response(JSON.stringify({ error: "Upload Failed" }), { status: 500 });
        
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${user.value}/${repo.value}/${path}`;
        return new Response(JSON.stringify({ url: cdnUrl }));
    }

    if (url.pathname === '/api/post' && method === 'POST') {
        const body = await request.json();
        await env.DB.prepare(
            "INSERT INTO posts (title, content, category, image, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(body.title, body.content, body.category, body.image, Date.now()).run();
        return new Response("Post Saved");
    }

    return new Response("Not Found", { status: 404 });
}

// 注意：handleAdmin 函数已被删除
