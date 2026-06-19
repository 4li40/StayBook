import { Globe, Share2 } from "lucide-react";

export default function Footer() {
  const links = [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Contact Us", href: "#" },
    { label: "Careers", href: "#" },
  ];

  return (
    <footer className="w-full border-t border-ghost-border bg-muted px-6 py-12">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 md:flex-row md:justify-between">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <span className="font-heading text-xl font-semibold text-foreground">
            StayBook
          </span>
          <p className="max-w-xs text-center text-sm text-muted-foreground md:text-left">
            © {new Date().getFullYear()} StayBook Luxury Hospitality Group. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {links.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-sm text-muted-foreground underline transition-colors hover:text-gold focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex gap-3">
          <a
            href="#"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground transition-colors hover:bg-gold-container"
            aria-label="Website"
          >
            <Globe className="h-4 w-4" />
          </a>
          <a
            href="#"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground transition-colors hover:bg-gold-container"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
