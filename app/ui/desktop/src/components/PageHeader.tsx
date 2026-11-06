import { ReactNode } from "react";

export default function PageHeader({ title, description, actions, banner }: {
  title: string; description: string; actions?: ReactNode; banner?: ReactNode;
}) {
  return <header className={`workspace-page-header${banner ? " has-banner" : ""}`}>
    <div className="workspace-page-title"><h1>{title}</h1><p>{description}</p></div>
    {banner || (actions && <div className="workspace-page-actions">{actions}</div>)}
  </header>;
}
