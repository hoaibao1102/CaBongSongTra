import { notFound } from "next/navigation";
import { publicContent } from "../../lib/public-content";
export function generateStaticParams() {
  return Object.keys(publicContent).map((info) => ({ info }));
}
export default async function Information({
  params,
}: {
  params: Promise<{ info: string }>;
}) {
  const { info } = await params;
  const content = Object.hasOwn(publicContent, info)
    ? publicContent[info]
    : undefined;
  if (!content) notFound();
  return (
    <main>
      <a href="/">Cá Bống Sông Trà / Store</a>
      {(["vi", "en"] as const).map((lang) => (
        <section key={lang} lang={lang} className="panel">
          <h1 className="page-title">{content[lang].title}</h1>
          <p>{content[lang].body}</p>
        </section>
      ))}
    </main>
  );
}
