"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import styles from "./sidebar.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface SidebarProps {
  role: "student" | "teacher";
  userName: string;
}

const studentNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
];

const teacherNav: NavItem[] = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/teacher/setup", label: "Manage", icon: "⚙️" },
];

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === "teacher" ? teacherNav : studentNav;
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isActive = useCallback(
    (href: string) => {
      if (href.includes("#")) return pathname === href.split("#")[0];
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname]
  );

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        <span className={styles.hamburger} data-open={mobileOpen}>
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={styles.sidebar}
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <Link href={role === "teacher" ? "/teacher/dashboard" : "/dashboard"} className={styles.logoLink}>
            <span className={styles.logoIcon}>🎓</span>
            {!collapsed && <span className={styles.logoText}>Shiksha</span>}
          </Link>
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navItem}
              data-active={isActive(item.href)}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className={styles.spacer} />

        {/* User section */}
        <div className={styles.user}>
          <div className={styles.avatar}>{initials}</div>
          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userName}</span>
              <span className={styles.userRole}>{role}</span>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          className={styles.logoutBtn}
          onClick={handleLogout}
        >
          <span className={styles.navIcon}>🚪</span>
          {!collapsed && <span className={styles.navLabel}>Sign out</span>}
        </button>
      </aside>
    </>
  );
}
