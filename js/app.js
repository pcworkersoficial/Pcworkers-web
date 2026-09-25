// IMPORTACIÓN DE THREE.JS (Requiere type="module" en HTML)
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

document.addEventListener("DOMContentLoaded", () => {

    /* ====================================
       HEADER GLASS AL HACER SCROLL
       ==================================== */
    const header = document.querySelector(".header");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 60) {
            header.classList.add("header-scrolled");
        } else {
            header.classList.remove("header-scrolled");
        }
    });

    /* ====================================
       SCROLL SUAVE MENÚ
       ==================================== */
    const menuLinks = document.querySelectorAll('a[href^="#"]');
    menuLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            const targetId = link.getAttribute("href");
            const target = document.querySelector(targetId);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    /* ====================================
       ANIMACIÓN REVEAL
       ==================================== */
    const revealElements = document.querySelectorAll(
        ".card, .section-title, .hero-content, .business-content, .business-image"
    );
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                }
            });
        },
        { threshold: 0.15 }
    );
    revealElements.forEach((element) => {
        element.classList.add("reveal");
        observer.observe(element);
    });

    /* ====================================
       ANIMACIÓN HERO ESCALONADA
       ==================================== */
    const heroElements = document.querySelectorAll(
        ".eyebrow, .hero h1, .hero h2, .hero-description, .hero-buttons"
    );
    heroElements.forEach((element, index) => {
        element.style.opacity = "0";
        element.style.transform = "translateY(20px)";
        setTimeout(() => {
            element.style.transition = "opacity .8s ease, transform .8s ease";
            element.style.opacity = "1";
            element.style.transform = "translateY(0)";
        }, index * 200);
    });

    /* ====================================
       FONDO 3D INTERACTIVO (Three.js)
       ==================================== */
    const container = document.getElementById('hero-canvas-container');

    if (container) {
        // 1. CONFIGURACIÓN BASE
        const scene = new THREE.Scene();
        const width = container.clientWidth;
        const height = container.clientHeight;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 30;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // 2. CREACIÓN DE LAS PARTÍCULAS
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesCount = 400; 
        const posArray = new Float32Array(particlesCount * 3);

        for(let i = 0; i < particlesCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 100;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

        // Color alineado con --primary-light (#38bdf8)
        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.25,
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.8
        });

        const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particlesMesh);

        // 3. SEGUIMIENTO DEL MOUSE
        let mouseX = 0;
        let mouseY = 0;

        document.addEventListener('mousemove', (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // 4. ANIMACIÓN
        function animate() {
            requestAnimationFrame(animate);

            // Rotación base
            particlesMesh.rotation.y += 0.001;
            particlesMesh.rotation.x += 0.0005;

            // Reacción al mouse (suave)
            particlesMesh.position.x += (mouseX * 5 - particlesMesh.position.x) * 0.05;
            particlesMesh.position.y += (mouseY * 5 - particlesMesh.position.y) * 0.05;

            renderer.render(scene, camera);
        }
        animate();

        // 5. RESPONSIVE
        window.addEventListener('resize', () => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        });
    }
});
