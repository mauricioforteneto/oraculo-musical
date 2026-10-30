export const THEME_STORAGE_KEY = "oraculo-theme";

// Runs before the body paints; the CSS media query also covers JavaScript disabled.
export const THEME_INIT_SCRIPT = `(()=>{let p="system";try{const v=localStorage.getItem("${THEME_STORAGE_KEY}");if(v==="light"||v==="dark")p=v}catch{}const r=document.documentElement;const m=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;r.dataset.themePreference=p;r.dataset.mode=m;r.classList.toggle("dark",m==="dark")})();`;
