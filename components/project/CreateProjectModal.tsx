import React from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import ProjectCreation from "./ProjectCreation";
import { Modal, ModalHeader, ModalContent, ModalTitle } from "../ui/Modal";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { data: session } = useSession();

  // Handle project creation completion
  const handleProjectCreated = (projectId: string) => {
    onClose();
    router.push(`/project/${projectId}/dashboard`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        <ModalTitle>Create New Project</ModalTitle>
      </ModalHeader>
      <ModalContent>
        <ProjectCreation
          userId={session?.user?.id as string}
          onProjectCreated={handleProjectCreated}
        />
      </ModalContent>
    </Modal>
  );
};

export default CreateProjectModal;
