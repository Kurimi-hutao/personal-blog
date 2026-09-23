(function () {
  "use strict";

  window.HutaoWorksData = {
    categories: ["全部", "H5 与网页作品", "Manim 与动画", "Live2D 与桌宠", "AI 视觉实验", "比赛项目"],
    works: [
      {
        title: "永劫无间征神图鉴",
        category: "H5 与网页作品",
        description: "永劫无间征神之路魂玉图鉴。前往独立图鉴站查看，目前访问需登录 ChatGPT。",
        tech: ["征神之路", "魂玉图鉴"],
        date: "2026-09",
        demo: "https://zhengshen-jade-atlas.jojozzzz.chatgpt.site/",
        demoLabel: "进入图鉴",
        cover: "./assets/ink-scroll.webp",
      },
      {
        title: "下一代，来信了",
        category: "比赛项目",
        description: "2026 重庆青年写给红岩英烈的一封回信。展开信封，沿着历史与当下交织的长卷，读懂属于下一代的回答。",
        tech: ["叙事长页", "交互动画", "GSAP"],
        date: "2026-09",
        demo: "./next-generation-letter/",
        demoLabel: "进入子站",
        source: "https://github.com/Kurimi-hutao/next-generation-letter",
        cover: "./assets/next-generation-letter-cover.webp",
      },
      {
        title: "个人博客",
        category: "H5 与网页作品",
        description: "当前这座水墨江湖博客，包含文章、视频、留言、搜索、明暗主题与后台管理。",
        tech: ["HTML", "CSS", "JavaScript", "Supabase"],
        date: "2026-06",
        demo: "./index.html",
        source: "https://github.com/Kurimi-hutao/personal-blog",
        cover: "./assets/ink-hero-desktop.webp",
      },
      {
        title: "胡桃绘卷",
        category: "AI 视觉实验",
        description: "以胡桃角色资料和站内素材组织的角色绘卷、人物志与水墨画廊。",
        tech: ["HTML", "CSS", "Lightbox"],
        date: "2026-06",
        demo: "./kurumi.html",
        source: "https://github.com/Kurimi-hutao/personal-blog",
        cover: "./assets/kurumi-portrait-red-moon.webp",
        coverPosition: "50% 18%",
      },
      {
        title: "Live2D 桌宠小屋",
        category: "Live2D 与桌宠",
        description: "保留本地养成状态的互动桌宠页面，支持角色切换、动作反馈和 Live2D 回退图。",
        tech: ["Live2D", "PixiJS", "JavaScript"],
        date: "2026-06",
        demo: "./pet.html",
        source: "https://github.com/Kurimi-hutao/personal-blog",
        cover: "./assets/hutao-entry-shanshui.webp",
      },
    ],
    logs: [
      {
        date: "2026-09-23",
        title: "永劫无间征神图鉴加入作品卷宗",
        description: "新增征神之路魂玉图鉴入口，可从作品页前往独立图鉴站。",
      },
      {
        date: "2026-09-22",
        title: "《下一代，来信了》加入作品卷宗",
        description: "以独立子站收录这封写给红岩英烈的回信，从作品页即可进入阅读。",
      },
      {
        date: "2026-06-28",
        title: "第一轮 UI 与动效整理",
        description: "统一页面转场、点击反馈和动态显现逻辑，新增作品卷宗入口。",
      },
      {
        date: "2026-06",
        title: "桌宠小屋上线",
        description: "接入 Live2D 与本地养成状态，加入基础互动动作。",
      },
      {
        date: "2026-06",
        title: "文章与视频系统接入",
        description: "通过 Supabase 管理文章、视频、评论、留言与后台内容。",
      },
    ],
  };
}());
