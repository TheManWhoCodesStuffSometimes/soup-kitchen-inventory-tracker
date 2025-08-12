// Simplified test version - just to see if the issue persists
export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture, onSuccess }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Test Camera Modal">
      <div className="space-y-4">
        <p>Test modal - click analyze to see if it still breaks</p>
        <Button onClick={() => console.log('Test button clicked')}>
          Test Analyze Photo
        </Button>
        <Button onClick={onClose} variant="secondary">
          Cancel
        </Button>
      </div>
    </Modal>
  );
};
