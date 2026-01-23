import React from "react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface PageHeaderProps {
  title: string;
  crumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, crumbs, actions, className }: PageHeaderProps) {
  const breadcrumb = crumbs && crumbs.length > 0
    ? crumbs
    : [{ label: "Início", href: "/" }, { label: title }];

  return (
    <div className={`page-header ${className ?? ""}`.trim()}>
      <div>
        <h1 className="page-title">{title}</h1>
        {breadcrumb && (
          <nav className="breadcrumb mt-1">
            {breadcrumb.map((c, idx) => (
              <React.Fragment key={`${c.label}-${idx}`}>
                {idx > 0 && <span className="breadcrumb-sep">/</span>}
                {c.href ? (
                  <a href={c.href}>{c.label}</a>
                ) : (
                  <span>{c.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>
      <div className="toolbar">
        {actions}
      </div>
    </div>
  );
}

export default PageHeader;
