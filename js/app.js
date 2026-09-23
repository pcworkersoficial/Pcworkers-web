document.addEventListener("DOMContentLoaded", () => {

    /*
    ====================================
    HEADER GLASS AL HACER SCROLL
    ====================================
    */

    const header = document.querySelector(".header");

    window.addEventListener("scroll", () => {

        if (window.scrollY > 60) {
            header.classList.add("header-scrolled");
        } else {
            header.classList.remove("header-scrolled");
        }

    });


    /*
    ====================================
    SCROLL SUAVE MENÚ
    ====================================
    */

    const menuLinks = document.querySelectorAll('a[href^="#"]');

    menuLinks.forEach(link => {

        link.addEventListener("click", (e) => {

            const targetId = link.getAttribute("href");
            const target = document.querySelector(targetId);

            if (!target) return;

            e.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

        });

    });


    /*
    ====================================
    ANIMACIÓN REVEAL
    ====================================
    */

    const revealElements = document.querySelectorAll(
        ".card, .section-title, .step, .hero-content, .hero-visual, .business-content, .business-image"
    );

    const observer = new IntersectionObserver(

        (entries) => {

            entries.forEach((entry) => {

                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                }

            });

        },

        {
            threshold: 0.15
        }

    );

    revealElements.forEach((element) => {
        element.classList.add("reveal");
        observer.observe(element);
    });


    /*
    ====================================
    ANIMACIÓN HERO ESCALONADA
    ====================================
    */

    const heroElements = document.querySelectorAll(
        ".eyebrow, .hero h1, .hero h2, .hero-description, .hero-buttons"
    );

    heroElements.forEach((element, index) => {

        element.style.opacity = "0";
        element.style.transform = "translateY(20px)";

        setTimeout(() => {

            element.style.transition =
                "opacity .8s ease, transform .8s ease";

            element.style.opacity = "1";
            element.style.transform = "translateY(0)";

        }, index * 200);

    });


    /*
    ====================================
    LOG
    ====================================
    */

    console.log(
        "PCWORKERS | Soporte técnico que habla tu idioma."
    );

});