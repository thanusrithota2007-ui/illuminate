export default function MirrorFrame({
  src,
  alt = "Your reflection",
}) {
  return (
    <div
      className="mirror"
      role="img"
      aria-label={src ? alt : "Antique gold mirror, empty"}
    >
      {src && (
        <img
          className="mirror-photo"
          src={src}
          alt=""
          aria-hidden="true"
        />
      )}

      <img
        className="mirror-frame"
        src="/images/antique-mirror.png"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
