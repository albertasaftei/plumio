import styles from "./styles.module.css";

const carouselSlides = [
  {
    src: "/img/app-preview-v2.3.0.webp",
    caption: "Markdown Editor",
    label: "Write with confidence",
  },
  {
    src: "/img/organizations-preview-v2.4.0.webp",
    caption: "Multi-Organization",
    label: "Scale across teams",
  },
  {
    src: "/img/themes-preview-v2.4.0.webp",
    caption: "Custom themes support",
    label: "Designed for your comfort",
  },
];

export default function ScreenshotCarousel() {
  return (
    <div className={styles["carousel-outer"]}>
      <div className={styles["carousel-wrapper"]}>
        <div className={styles["carousel-track"]}>
          {[...carouselSlides, ...carouselSlides].map((slide, i) => (
            <div key={i} className={styles["carousel-slide"]}>
              <div className={styles["slide-caption"]}>
                <span className={styles["slide-label"]}>{slide.label}</span>
                <span className={styles["slide-title"]}>{slide.caption}</span>
              </div>
              <img
                src={slide.src}
                alt={slide.caption}
                className={styles["slide-image"]}
              />
            </div>
          ))}
        </div>
        <div className={styles["carousel-fade-left"]} />
        <div className={styles["carousel-fade-right"]} />
      </div>
    </div>
  );
}
