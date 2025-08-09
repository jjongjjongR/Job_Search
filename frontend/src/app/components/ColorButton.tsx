// app/components/ColorButton.tsx
interface ColorButtonProps {
    text: string;
    onClick: () => void;
    className?: string; // className을 optional로 추가
  }
  
  export default function ColorButton({ text, onClick, className }: ColorButtonProps) {
    return (
      <button
        onClick={onClick}
        className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ease-in-out ${className} dark:bg-light-blue dark:hover:bg-hover-blue dark:text-black`}
      >
        {text}
      </button>
    );
  }
  