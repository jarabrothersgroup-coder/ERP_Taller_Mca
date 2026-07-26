import type { NextPageContext } from "next";

interface ErrorPageProps {
  statusCode: number;
}

export default function ErrorPage({ statusCode }: ErrorPageProps) {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "3rem", fontWeight: "bold", margin: 0 }}>
          {statusCode || "Error"}
        </h1>
        <p style={{ marginTop: "0.5rem", color: "#94a3b8" }}>
          {statusCode === 404
            ? "Página no encontrada"
            : "Error del servidor"}
        </p>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};
