"use client";

import { Search, Calendar, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export function Header() {
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const time = now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setDateTime(`${date.charAt(0).toUpperCase() + date.slice(1)} — ${time}`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-white px-6">
      <div className="flex-1 flex items-center gap-4">
        <div className="relative max-w-md flex-1 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-10 bg-muted/50 border-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline">{dateTime}</span>
      </div>
    </header>
  );
}
