(function () {
  const config = window.BLOG_CONFIG || {};
  const configured =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.startsWith("YOUR_") &&
    !config.supabaseAnonKey.startsWith("YOUR_");

  const client =
    configured && window.supabase
      ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
      : null;

  function requireClient() {
    if (!client) {
      throw new Error("文章服务尚未配置，请先填写 supabase-config.js。");
    }
    return client;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(value));
  }

  function articleUrl(article) {
    return `./article.html?slug=${encodeURIComponent(article.slug)}`;
  }

  function contentLabel(item) {
    return item.content_type === "video" ? "视频" : "文章";
  }

  function isOwner(session) {
    return Boolean(session?.user?.id && session.user.id === config.ownerUserId);
  }

  function firstImage(article) {
    return (article.attachments || []).find((file) => file.type?.startsWith("image/"));
  }

  function isSchemaMismatch(error) {
    return /column .* does not exist|schema cache|could not find|deleted_at|pinned|series_name|duration_seconds/i.test(error?.message || "");
  }

  async function listPublishedLegacy(limit, filters = {}) {
    if (filters.contentType === "video") return [];
    let query = requireClient()
      .from("articles")
      .select("id,title,slug,excerpt,attachments,published_at,created_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return data.map((article) => ({
      ...article,
      category: "随笔",
      tags: [],
      view_count: 0,
      like_count: 0,
      favorite_count: 0,
      content_type: "article",
      video_url: null,
      video_poster: null,
      video_path: null,
      video_name: null,
    }));
  }

  async function listPublishedV6(limit, filters = {}) {
    let query = requireClient()
      .from("articles")
      .select("id,title,slug,excerpt,attachments,category,tags,published_at,created_at,view_count,like_count,favorite_count,content_type,video_url,video_poster,video_path,video_name")
      .eq("published", true)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("published_at", { ascending: false });
    if (filters.category) query = query.eq("category", filters.category);
    if (filters.contentType) query = query.eq("content_type", filters.contentType);
    if (filters.search) {
      const search = filters.search.replace(/[%_,()]/g, " ").trim();
      if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }
    if (filters.tag) query = query.contains("tags", [filters.tag]);
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error && isSchemaMismatch(error)) return listPublishedLegacy(limit, filters);
    if (error) throw error;
    return data.map((item) => ({
      ...item,
      series_name: null,
      episode_number: null,
      duration_seconds: null,
    }));
  }

  function getVisitorToken() {
    const key = "hutao-visitor-token";
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    return token;
  }

  async function listPublished(limit, filters = {}) {
    let query = requireClient()
      .from("articles")
      .select("id,title,slug,excerpt,attachments,category,tags,published_at,created_at,view_count,like_count,favorite_count,content_type,video_url,video_poster,video_path,video_name,series_name,episode_number,duration_seconds")
      .eq("published", true)
      .is("deleted_at", null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("published_at", { ascending: false });

    if (filters.category) query = query.eq("category", filters.category);
    if (filters.contentType) query = query.eq("content_type", filters.contentType);
    if (filters.search) {
      const search = filters.search.replace(/[%_,()]/g, " ").trim();
      if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }
    if (filters.tag) query = query.contains("tags", [filters.tag]);
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error && isSchemaMismatch(error)) {
      return listPublishedV6(limit, filters);
    }
    if (error) throw error;
    return data;
  }

  async function getPublished(slug) {
    let { data, error } = await requireClient()
      .from("articles")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .is("deleted_at", null)
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .single();
    if (error && isSchemaMismatch(error)) {
      ({ data, error } = await requireClient()
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .single());
      if (data) {
        data.category ||= "随笔";
        data.tags ||= [];
        data.view_count ||= 0;
        data.like_count ||= 0;
        data.favorite_count ||= 0;
        data.content_type ||= "article";
        data.video_url ||= null;
        data.video_poster ||= null;
        data.video_path ||= null;
        data.video_name ||= null;
        data.series_name = null;
        data.episode_number = null;
        data.duration_seconds = null;
      }
    }
    if (error) throw error;
    return data;
  }

  async function listAllArticles() {
    const { data, error } = await requireClient()
      .from("articles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map((article) => ({
      category: "随笔",
      tags: [],
      view_count: 0,
      like_count: 0,
      favorite_count: 0,
      content_type: "article",
      video_url: null,
      video_poster: null,
      video_path: null,
      video_name: null,
      ...article,
    }));
  }

  async function listRelated(article, limit = 3) {
    let query = requireClient()
      .from("articles")
      .select("id,title,slug,excerpt,attachments,category,tags,published_at,content_type,video_url,video_poster,series_name,episode_number")
      .eq("published", true)
      .is("deleted_at", null)
      .neq("id", article.id)
      .eq("content_type", article.content_type || "article")
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (article.category) query = query.eq("category", article.category);
    const { data, error } = await query;
    if (error && isSchemaMismatch(error)) {
      let legacyQuery = requireClient()
        .from("articles")
        .select("id,title,slug,excerpt,attachments,category,tags,published_at,content_type,video_url,video_poster")
        .eq("published", true)
        .neq("id", article.id)
        .eq("content_type", article.content_type || "article")
        .order("published_at", { ascending: false })
        .limit(limit);
      if (article.category) legacyQuery = legacyQuery.eq("category", article.category);
      const legacy = await legacyQuery;
      if (legacy.error) return [];
      return legacy.data;
    }
    if (error) throw error;
    return data;
  }

  async function getSession() {
    const { data, error } = await requireClient().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  async function signIn(email, password) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }

  async function uploadFiles(files, userId) {
    const uploaded = [];
    for (const file of files) {
      const cleanName = file.name.replace(/[^\w.\-]+/g, "-");
      const path = `${userId}/${crypto.randomUUID()}-${cleanName}`;
      const { error } = await requireClient().storage
        .from("article-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      const { data } = requireClient().storage.from("article-attachments").getPublicUrl(path);
      uploaded.push({
        name: file.name,
        path,
        url: data.publicUrl,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    }
    return uploaded;
  }

  async function removeFiles(files) {
    const paths = files.map((file) => file.path).filter(Boolean);
    if (!paths.length) return;
    const { error } = await requireClient().storage.from("article-attachments").remove(paths);
    if (error) throw error;
  }

  async function uploadVideo(file, userId) {
    const cleanName = file.name.replace(/[^\w.\-]+/g, "-") || "video";
    const path = `${userId}/${crypto.randomUUID()}-${cleanName}`;
    const { error } = await requireClient().storage
      .from("video-assets")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = requireClient().storage.from("video-assets").getPublicUrl(path);
    return {
      name: file.name,
      path,
      url: data.publicUrl,
      type: file.type,
      size: file.size,
    };
  }

  async function removeVideo(video) {
    if (!video?.path) return;
    if (String(video.path).startsWith("r2:")) {
      console.info("R2 video deletion is skipped locally. Remove it from Cloudflare R2 if it is no longer needed:", video.path);
      return;
    }
    const { error } = await requireClient().storage.from("video-assets").remove([video.path]);
    if (error) throw error;
  }

  async function publishArticle(article) {
    const { data, error } = await requireClient()
      .from("articles")
      .insert(article)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updateArticle(id, article) {
    const { data, error } = await requireClient()
      .from("articles")
      .update({ ...article, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteArticle(id) {
    const { error } = await requireClient()
      .from("articles")
      .update({ deleted_at: new Date().toISOString(), published: false })
      .eq("id", id);
    if (error) throw error;
  }

  async function restoreArticle(id) {
    const { error } = await requireClient().from("articles").update({ deleted_at: null }).eq("id", id);
    if (error) throw error;
  }

  async function permanentlyDeleteArticle(id) {
    const { error } = await requireClient().from("articles").delete().eq("id", id);
    if (error) throw error;
  }

  async function listComments(articleId) {
    let { data, error } = await requireClient()
      .from("comments")
      .select("*")
      .eq("article_id", articleId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: true });
    if (error && isSchemaMismatch(error)) {
      ({ data, error } = await requireClient()
        .from("comments")
        .select("*")
        .eq("article_id", articleId)
        .order("created_at", { ascending: true }));
      if (data) {
        data = data.map((comment) => ({
          like_count: 0,
          pinned: false,
          is_owner: false,
          ...comment,
        }));
      }
    }
    if (error) throw error;
    return data;
  }

  async function listAllComments() {
    const { data, error } = await requireClient()
      .from("comments")
      .select("*,articles(title,content_type)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async function uploadCommentFiles(files, articleId) {
    const uploaded = [];
    for (const file of files) {
      const cleanName = file.name.replace(/[^\w.\-]+/g, "-") || "file";
      const path = `${articleId}/${crypto.randomUUID()}-${cleanName}`;
      const { error } = await requireClient().storage
        .from("comment-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      const { data } = requireClient().storage.from("comment-attachments").getPublicUrl(path);
      uploaded.push({
        name: file.name,
        path,
        url: data.publicUrl,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    }
    return uploaded;
  }

  async function createComment(comment) {
    let { data, error } = await requireClient()
      .from("comments")
      .insert(comment)
      .select()
      .single();
    if (error && isSchemaMismatch(error)) {
      const legacy = {
        article_id: comment.article_id,
        visitor_name: comment.visitor_name,
        body: comment.body,
        attachments: comment.attachments,
      };
      ({ data, error } = await requireClient().from("comments").insert(legacy).select().single());
    }
    if (error) throw error;
    return data;
  }

  async function updateCommentApproval(id, approved) {
    const { error } = await requireClient().from("comments").update({ approved }).eq("id", id);
    if (error) throw error;
  }

  async function updateCommentPinned(id, pinned) {
    const { error } = await requireClient().from("comments").update({ pinned }).eq("id", id);
    if (error) throw error;
  }

  async function toggleCommentReaction(commentId) {
    const { data, error } = await requireClient().rpc("toggle_comment_reaction", {
      target_comment: commentId,
      target_token: getVisitorToken(),
    });
    if (error) throw error;
    localStorage.setItem(`hutao-comment-like-${commentId}`, String(data.active));
    return data;
  }

  function hasCommentReaction(commentId) {
    return localStorage.getItem(`hutao-comment-like-${commentId}`) === "true";
  }

  async function deleteComment(id) {
    const { error } = await requireClient().from("comments").delete().eq("id", id);
    if (error) throw error;
  }

  async function removeCommentFiles(files) {
    const paths = files.map((file) => file.path).filter(Boolean);
    if (!paths.length) return;
    const { error } = await requireClient().storage.from("comment-attachments").remove(paths);
    if (error) throw error;
  }

  async function listMessages(limit = 20) {
    const { data, error } = await requireClient()
      .from("guestbook_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }

  async function createMessage(message) {
    const { data, error } = await requireClient()
      .from("guestbook_messages")
      .insert(message)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function deleteMessage(id) {
    const { error } = await requireClient().from("guestbook_messages").delete().eq("id", id);
    if (error) throw error;
  }

  async function recordView(articleId) {
    const { data, error } = await requireClient().rpc("record_article_view", {
      target_article: articleId,
      target_token: getVisitorToken(),
    });
    if (error && /function .* does not exist|schema cache/i.test(error.message || "")) return 0;
    if (error) throw error;
    return data;
  }

  async function recordVideoComplete(articleId) {
    const { error } = await requireClient().rpc("record_video_complete", {
      target_article: articleId,
      target_token: getVisitorToken(),
    });
    if (error) throw error;
  }

  async function checkIn() {
    const { data, error } = await requireClient().rpc("visitor_check_in", {
      target_token: getVisitorToken(),
    });
    if (error) throw error;
    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem("hutao-last-checkin", localDate);
    return data;
  }

  function checkedInToday() {
    const now = new Date();
    const localDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    return localStorage.getItem("hutao-last-checkin") === localDate;
  }

  async function getOwnerDashboard() {
    const { data, error } = await requireClient().rpc("get_owner_dashboard");
    if (error) throw error;
    return data;
  }

  async function recordSiteVisit() {
    const visitKey = "hutao-site-visit";
    const alreadyVisited = sessionStorage.getItem(visitKey);
    const { data, error } = await requireClient().rpc("record_site_visit", {
      should_increment: !alreadyVisited,
    });
    if (error && /function .* does not exist|schema cache/i.test(error.message || "")) {
      const articles = await listPublished();
      return articles.reduce((total, article) => total + Number(article.view_count || 0), 0);
    }
    if (error) throw error;
    sessionStorage.setItem(visitKey, "1");
    return Number(data || 0);
  }

  async function toggleReaction(articleId) {
    const { data, error } = await requireClient().rpc("toggle_article_reaction", {
      target_article: articleId,
      target_token: getVisitorToken(),
      target_type: "like",
    });
    if (error) throw error;
    localStorage.setItem(`hutao-like-${articleId}`, String(data.active));
    return data;
  }

  function hasReaction(articleId) {
    return localStorage.getItem(`hutao-like-${articleId}`) === "true";
  }

  window.articleService = {
    client,
    configured,
    formatDate,
    articleUrl,
    contentLabel,
    isOwner,
    firstImage,
    getVisitorToken,
    listPublished,
    getPublished,
    listAllArticles,
    listRelated,
    getSession,
    signIn,
    signOut,
    uploadFiles,
    removeFiles,
    uploadVideo,
    removeVideo,
    publishArticle,
    updateArticle,
    deleteArticle,
    restoreArticle,
    permanentlyDeleteArticle,
    listComments,
    listAllComments,
    uploadCommentFiles,
    createComment,
    updateCommentApproval,
    updateCommentPinned,
    toggleCommentReaction,
    hasCommentReaction,
    deleteComment,
    removeCommentFiles,
    listMessages,
    createMessage,
    deleteMessage,
    recordView,
    recordVideoComplete,
    recordSiteVisit,
    checkIn,
    checkedInToday,
    getOwnerDashboard,
    toggleReaction,
    hasReaction,
  };
})();
