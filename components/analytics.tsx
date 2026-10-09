"use client";
import Script from "next/script";
export function Analytics(){ const id=process.env.NEXT_PUBLIC_GA_ID; if(!id || !/^G-[A-Z0-9]+$/.test(id)) return null; return <><Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive"/><Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${id}');`}</Script></> }
