document.addEventListener("DOMContentLoaded", () => {

    console.log("Pcworkers cargado correctamente");

    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {

        link.addEventListener("click", e => {

            const targetId = link.getAttribute("href");
            const target = document.querySelector(targetId);

            if (target) {
                e.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });
            }

        });

    });

});