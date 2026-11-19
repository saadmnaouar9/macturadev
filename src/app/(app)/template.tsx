"use client";

import { motion } from "framer-motion";

/** Transition douce entre les pages de l'application. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
