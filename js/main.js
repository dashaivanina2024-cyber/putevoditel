/* Общая логика: стрелки клавиатуры работают как навигационные стрелки страницы. */
(function () {
  const prev = document.querySelector('[data-nav="prev"]');
  const next = document.querySelector('[data-nav="next"]');
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "ArrowRight" && next) next.click();
    if (e.key === "ArrowLeft" && prev) prev.click();
    if (e.key === "Escape") {
      const lb = document.querySelector(".lightbox.open");
      if (lb) lb.classList.remove("open");
      const co = document.querySelector(".card-overlay");
      if (co) co.classList.remove("open");
    }
  });
})();
