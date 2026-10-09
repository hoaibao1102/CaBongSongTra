"use client";
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

const navItems = [
  { href: "#dau-trang", label: "Trang chủ", id: "dau-trang" },
  { href: "#san-pham", label: "Sản phẩm", id: "san-pham" },
  { href: "#bang-gia", label: "Bảng giá & Size", id: "bang-gia" },
  { href: "#cau-chuyen", label: "Hương vị", id: "cau-chuyen" },
  { href: "#bao-quan", label: "Bảo quản", id: "bao-quan" },
  { href: "#cach-mua", label: "Cách đặt mua", id: "cach-mua" },
  { href: "#faq", label: "Hỏi đáp FAQ", id: "faq" },
];

export function Header() {
  const [activeSection, setActiveSection] = useState<string>("dau-trang");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial active section from hash if present
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.replace("#", "");
      if (navItems.some((item) => item.id === hash)) {
        setActiveSection(hash);
      }
    }

    const handleScroll = () => {
      // Don't override active item during programmatic smooth scroll click
      if (isScrollingRef.current) return;

      // 1. If near the very top of page -> Trang chủ
      if (window.scrollY < 180) {
        setActiveSection("dau-trang");
        return;
      }

      // 2. If near bottom of document -> FAQ
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 60
      ) {
        setActiveSection("faq");
        return;
      }

      // 3. Check sections using getBoundingClientRect
      const sectionIds = [
        "faq",
        "cach-mua",
        "bao-quan",
        "cau-chuyen",
        "bang-gia",
        "san-pham",
      ];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom > 80) {
            setActiveSection(id);
            return;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();
    setActiveSection(id);
    setMobileMenuOpen(false);

    isScrollingRef.current = true;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 750);

    if (id === "dau-trang") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", window.location.pathname);
      }
      return;
    }

    const target = document.getElementById(id);
    if (target) {
      const headerOffset = 76;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `#${id}`);
      }
    }
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a
          href="#dau-trang"
          className="brand brand-wordmark"
          aria-label="Cá Bống Sông Trà - Về đầu trang"
          onClick={(e) => handleNavClick(e, "dau-trang")}
        >
          <span className="wordmark-title">Cá Bống Sông Trà</span>
          <span className="wordmark-sub">ĐẶC SẢN QUẢNG NGÃI</span>
        </a>

        {/* Desktop Navigation - Minimalist Text with Underline Indicator */}
        <nav aria-label="Điều hướng chính" className="desktop-nav">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
                onClick={(e) => handleNavClick(e, item.id)}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="header-actions">
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <div className="container mobile-nav-inner">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`mobile-nav-link ${isActive ? "active" : ""}`}
                  onClick={(e) => handleNavClick(e, item.id)}
                >
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
