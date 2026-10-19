# 铺满封面与新增水墨素材

文章首页和文章列表在双端使用 `object-fit: cover; object-position: center`，保持原图比例并居中裁切铺满容器，不拉伸、不重复贴图、不留画框空边。原有入场和悬停动效保留。

使用 imagegen 新生成三个独立的无文字、无边框水墨横幅，保存为 1280px 宽的 WebP：

- `assets/article-covers/mist-river.webp`：烟岚渡舟，1280×720。
- `assets/article-covers/bamboo-bridge.webp`：竹溪石桥，1280×640。
- `assets/article-covers/moon-pavilion.webp`：月下亭台，1280×720。

三张加入默认封面池，替换旧的卷轴式默认图。默认池共有六张；按文章标识散列分配，跨首页、文章列表及刷新保持一致。已有文章自带图片优先，视频封面不受影响。

验证覆盖：双端铺满样式、所有默认封面能加载、分配多样性、跨页面与刷新稳定、已有封面保留，以及现有布局、入场、悬停与减少动态效果检查。
