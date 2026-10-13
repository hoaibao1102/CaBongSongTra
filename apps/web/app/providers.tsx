"use client";

import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAdminQueryClient } from "../lib/query-cache";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAdminQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

export default Providers;
