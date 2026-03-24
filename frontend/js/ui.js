export function toggleAccordion(btn, bodyId) {
  const body = document.getElementById(bodyId);
  const isOpen = body.classList.toggle("open");
  btn.setAttribute("aria-expanded", isOpen);
}
