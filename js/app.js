// Usamos IntersectionObserver para detectar cuando los elementos entran en pantalla
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
});

// Seleccionamos las tarjetas para animarlas
const elementsToAnimate = document.querySelectorAll('.card-step, .card-service');

elementsToAnimate.forEach((el) => {
    // Estado inicial invisible
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    
    // Le decimos al observer que vigile este elemento
    observer.observe(el);
});
