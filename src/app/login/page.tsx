import { ArrowUpRight, ChartNoAxesColumnIncreasing, Disc3, LockKeyhole, ShieldCheck } from "lucide-react";
import { authConfigured } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ready = authConfigured();
  return <div className="entry">
    <header className="entry-header"><Brand /><span className="header-note"><LockKeyhole size={12} aria-hidden="true" /> Seu espaço pessoal</span></header>
    <main className="entry-body"><section aria-labelledby="welcome-title">
      <p className="eyebrow">PARA QUEM OUVE DE VERDADE</p>
      <h1 id="welcome-title" className="hero-title">Discos que ficam.<br /><em>Escutas que<br />contam histórias.</em></h1>
      <p className="lead">Um lugar para acompanhar seu ano em música. Revisite avaliações, descubra seus favoritos e dê a cada álbum o tempo que ele merece.</p>
      <div className="record-scene"><div className="record" aria-hidden="true"><div className="record-label">OM<span>33⅓ RPM</span></div></div><p className="record-caption"><strong>Além da primeira escuta.</strong>O que você ouviu.<br />O que ficou com você.</p></div>
    </section><Card className="access-card" aria-labelledby="access-title"><div className="card-main">
      <p className="card-kicker">SEU ACERVO, SEU OLHAR</p><h2 id="access-title" className="card-title">Entre no seu universo musical.</h2>
      <p className="card-description">Suas avaliações e descobertas, reunidas em um espaço só seu.</p>
      <form action="/auth/login" method="post"><Button type="submit" size="lg" className="w-full" disabled={!ready}>Entrar com Google <ArrowUpRight aria-hidden="true" /></Button></form>
      {!ready && <div className="notice mt-5" role="status"><strong>Seu espaço está em preparação</strong><p>O acesso pessoal ainda não foi configurado. Nenhum dado do acervo está disponível nesta instalação.</p></div>}
      {error && <p role="alert" className="error">{error === "access" ? "Esta conta não tem acesso ao acervo." : "Não foi possível concluir o login com Google. Tente novamente."}</p>}
      <div className="feature-list"><div className="feature"><span className="feature-icon"><Disc3 size={16} aria-hidden="true" /></span><div><h3>Cada disco, uma impressão</h3><p>Um olhar sobre suas avaliações.</p></div></div><div className="feature"><span className="feature-icon"><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /></span><div><h3>Seu ano em perspectiva</h3><p>Um espaço para acompanhar seus favoritos.</p></div></div></div>
    </div><div className="card-footer"><ShieldCheck size={13} aria-hidden="true" /> Consulta privada · sem cadastro público</div></Card></main>
    <footer className="entry-footer"><p>A avaliação vem primeiro. O campeonato acompanha.</p><p>ORÁCULO MUSICAL · FEITO PARA ESCUTAR MELHOR</p></footer>
  </div>;
}
