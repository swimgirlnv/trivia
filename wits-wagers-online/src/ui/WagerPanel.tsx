// WagerPanel UI component
const WagerPanel = ({ wager, setWager }: { wager: number; setWager: (w: number) => void }) => {
  return (
    <div className="wager-panel">
      <input type="number" value={wager} onChange={e => setWager(Number(e.target.value))} />
    </div>
  );
};

export default WagerPanel;
