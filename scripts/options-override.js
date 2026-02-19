(() => {
  const VERSION = "99.9.99";
  const zh = {
    recentHistory: "最近访问历史",
    allHistory: "所有历史",
    options: "设置",
    about: "关于",
    mainOptions: "主要设置",
    styleOptions: "样式设置",
    advanceOptions: "高级设置",
    option1: "最多显示多少条最近访问历史",
    option2: "最多显示多少条最近关闭的标签",
    option3: "最多显示多少条最常访问页面",
    option4: "最多显示多少条最近添加的书签",
    option5: "弹窗顺序",
    option6: "历史页",
    option7: "日期格式",
    option8: "在弹窗中显示搜索栏",
    option9: "预览",
    option10: "显示URL",
    option11: "显示分隔线",
    option12: "显示附加信息",
    option15: "弹窗宽度",
    option17: "在最近访问历史中过滤指定域名",
    option18: "左键单击操作",
    option20: "时间格式",
    yes: "是",
    no: "否",
    visits: "访问",
    click1: "在当前标签中打开",
    click2: "在新标签中打开",
    click3: "在新后台标签中打开",
    saveOptions: "保存设置"
  };

  const applyZh = () => {
    document.querySelectorAll('.lang[data-lang-string]').forEach((el) => {
      const k = el.getAttribute('data-lang-string');
      if (k && zh[k]) el.textContent = zh[k];
    });

    const saveBtn = document.getElementById('save');
    if (saveBtn) saveBtn.value = zh.saveOptions;

    const version = document.getElementById('app-version');
    if (version) version.textContent = VERSION;

    const changelogTab = document.querySelector('#tab-changelog span');
    if (changelogTab) changelogTab.textContent = '更新日志';
  };

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(applyZh, 120);
    setTimeout(applyZh, 600);
  });
})();
