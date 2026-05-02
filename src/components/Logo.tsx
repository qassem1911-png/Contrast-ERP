import logo from "../assets/contrast-logo.jpeg";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizeMap = {
  sm: "h-8",
  md: "h-12",
  lg: "h-20",
};

export const Logo = ({ size = "md" }: LogoProps) => {
  return (
    <img
      src={logo}
      alt="شركة كونتراست"
      className={`${sizeMap[size]} w-auto object-contain`}
    />
  );
};
