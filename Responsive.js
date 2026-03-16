/* ============================================================
   responsive.js — Hamburger menu + mobile fixes
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // ---- FIND SIDEBAR ----
    var sidebar = document.querySelector(
        '.sidebar, .side-nav, .nav-panel, .dashboard-sidebar, ' +
        'nav.sidebar, aside, [class*="sidebar"]'
    );

    // ---- CREATE HAMBURGER BUTTON ----
    var hamburger = document.createElement('button');
    hamburger.className = 'hamburger-toggle';
    hamburger.setAttribute('aria-label', 'Menu');
    hamburger.innerHTML = '&#9776;';
    document.body.insertBefore(hamburger, document.body.firstChild);

    // ---- CREATE OVERLAY ----
    var overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    // ---- SIDEBAR STATE ----
    var isOpen = false;

    function openSidebar() {
        if (!sidebar) return;
        isOpen = true;
        sidebar.classList.add('open');
        overlay.classList.add('active');
        hamburger.innerHTML = '&times;';
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (!sidebar) return;
        isOpen = false;
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        hamburger.innerHTML = '&#9776;';
        document.body.style.overflow = '';
    }

    // ---- CLICK HANDLERS ----
    hamburger.addEventListener('click', function (e) {
        e.stopPropagation();
        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener('click', closeSidebar);

    // Close sidebar when clicking a link inside it
    if (sidebar) {
        var links = sidebar.querySelectorAll('a');
        for (var i = 0; i < links.length; i++) {
            links[i].addEventListener('click', function () {
                if (window.innerWidth <= 1023) {
                    closeSidebar();
                }
            });
        }
    }

    // ---- ESCAPE KEY ----
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) {
            closeSidebar();
        }
    });

    // ---- HANDLE WINDOW RESIZE ----
    window.addEventListener('resize', function () {
        if (window.innerWidth > 1023) {
            closeSidebar();
            if (sidebar) {
                sidebar.style.transform = '';
            }
        }
    });

    // ---- FIX OVERFLOWING ELEMENTS ----
    window.addEventListener('load', function () {
        var vw = document.documentElement.clientWidth;
        var allElements = document.querySelectorAll('*');

        for (var j = 0; j < allElements.length; j++) {
            var el = allElements[j];
            if (el.offsetWidth > vw + 5) {
                var tag = el.tagName.toLowerCase();
                if (tag !== 'body' && tag !== 'html') {
                    el.style.maxWidth = '100%';
                    el.style.overflowX = 'auto';
                }
            }
        }
    });

    // ---- WRAP TABLES FOR SCROLL ----
    var tables = document.querySelectorAll('table');
    for (var k = 0; k < tables.length; k++) {
        var table = tables[k];
        var parent = table.parentElement;
        if (!parent.classList.contains('table-scroll-wrapper')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'table-scroll-wrapper';
            wrapper.style.width = '100%';
            wrapper.style.overflowX = 'auto';
            parent.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    }

    console.log('Responsive.js loaded | Screen: ' + window.innerWidth + 'x' + window.innerHeight);
});
