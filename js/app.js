document.addEventListener("DOMContentLoaded", () => {

    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {

        link.addEventListener("click", function(e){

            const targetId = this.getAttribute("href");

            if(targetId.startsWith("#")){

                e.preventDefault();

                const target = document.querySelector(targetId);

                if(target){

                    target.scrollIntoView({
                        behavior: "smooth"
                    });

                }

            }

        });

    });

});