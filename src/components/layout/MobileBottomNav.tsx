import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Upload, Layers, Settings } from "lucide-react";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard },
  { path: "/dashboard", label: "Upload", icon: Upload, action: "upload" },
  { path: "/dashboard/library", label: "Library", icon: Layers },
  { path: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface MobileBottomNavProps {
  onUploadClick?: () => void;
}

export default function MobileBottomNav({ onUploadClick }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.action ? false : location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.action === "upload" && onUploadClick) {
                  onUploadClick();
                } else {
                  navigate(item.path);
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
