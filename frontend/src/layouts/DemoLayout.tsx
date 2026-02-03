import { DemoBanner } from "~/components/DemoBanner";

const DemoLayout = ({ children }: { children: Node }) => {
  return (
    <div>
      <DemoBanner />
      {children}
    </div>
  );
};

export default DemoLayout;
