"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import styles from "./student-header.module.css";

interface StudentHeaderProps {
  userName: string;
  streak?: number;
}

export function StudentHeader({ userName, streak }: StudentHeaderProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const isDashboard = pathname === "/dashboard";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Left: Logo + nav */}
        <div className={styles.left}>
          <Link href="/dashboard" className={styles.logo}>
            <span className={styles.logoIcon}>🎓</span>
            <span className={styles.logoText}>Shiksha</span>
          </Link>
          {!isDashboard && (
            <Link href="/dashboard" className={styles.backLink}>
              ← Dashboard
            </Link>
          )}
        </div>

        {/* Right: Streak + user */}
        <div className={styles.right}>
          {typeof streak === "number" && streak > 0 && (
            <div className={styles.streak}>
              🔥 <span className={styles.streakCount}>{streak}</span>
            </div>
          )}

          <div className={styles.userArea}>
            <button
              className={styles.avatarBtn}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="User menu"
            >
              <div className={styles.avatar}>{initials}</div>
            </button>

            {showMenu && (
              <>
                <div
                  className={styles.menuOverlay}
                  onClick={() => setShowMenu(false)}
                />
                <div className={styles.menu}>
                  <div className={styles.menuUser}>
                    <span className={styles.menuName}>{userName}</span>
                    <span className={styles.menuRole}>Student</span>
                  </div>
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={handleLogout}>
                    🚪 Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
