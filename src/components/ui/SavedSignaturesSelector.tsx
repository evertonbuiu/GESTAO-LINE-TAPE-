import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSavedSignatures, SavedSignature } from '@/hooks/useSavedSignatures';
import { BookOpen, Plus, Trash2, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SavedSignaturesSelectorProps {
  signatureType: 'company' | 'client';
  currentSignature?: string;
  onSignatureSelect: (signatureData: string) => void;
  onSaveSignature?: (name: string, signatureData: string) => Promise<boolean>;
}

export function SavedSignaturesSelector({
  signatureType,
  currentSignature,
  onSignatureSelect,
  onSaveSignature
}: SavedSignaturesSelectorProps) {
  const { signatures, loading, saveSignature, deleteSignature, updateSignature } = useSavedSignatures(signatureType);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newSignatureName, setNewSignatureName] = useState('');
  const [editingSignature, setEditingSignature] = useState<SavedSignature | null>(null);

  const handleSaveCurrentSignature = async () => {
    if (!currentSignature) {
      toast.error('Nenhuma assinatura para salvar');
      return;
    }

    if (!newSignatureName.trim()) {
      toast.error('Digite um nome para a assinatura');
      return;
    }

    const success = onSaveSignature 
      ? await onSaveSignature(newSignatureName.trim(), currentSignature)
      : await saveSignature(newSignatureName.trim(), currentSignature);

    if (success) {
      setNewSignatureName('');
      setIsSaveDialogOpen(false);
    }
  };

  const handleSelectSignature = (signature: SavedSignature) => {
    onSignatureSelect(signature.signature_data);
    setIsOpen(false);
    toast.success(`Assinatura "${signature.name}" aplicada`);
  };

  const handleUpdateSignature = async () => {
    if (!editingSignature || !editingSignature.name.trim()) {
      toast.error('Nome da assinatura é obrigatório');
      return;
    }

    const success = await updateSignature(editingSignature.id, editingSignature.name.trim());
    if (success) {
      setEditingSignature(null);
    }
  };

  const handleDeleteSignature = async (signature: SavedSignature) => {
    await deleteSignature(signature.id);
  };

  return (
    <div className="flex items-center gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <BookOpen className="w-4 h-4 mr-1" />
            Assinaturas Salvas
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assinaturas Salvas - {signatureType === 'company' ? 'Empresa' : 'Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-4">Carregando...</div>
            ) : signatures.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhuma assinatura salva
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <img
                        src={signature.signature_data}
                        alt={signature.name}
                        className="w-16 h-8 object-contain border rounded"
                      />
                      {editingSignature?.id === signature.id ? (
                        <Input
                          value={editingSignature.name}
                          onChange={(e) =>
                            setEditingSignature(prev => prev ? { ...prev, name: e.target.value } : null)
                          }
                          className="flex-1"
                          autoFocus
                        />
                      ) : (
                        <div className="flex-1">
                          <div className="font-medium">{signature.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(signature.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {editingSignature?.id === signature.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUpdateSignature}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSignature(null)}
                          >
                            ×
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectSignature(signature)}
                          >
                            Usar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingSignature(signature)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza de que deseja excluir a assinatura "{signature.name}"?
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSignature(signature)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {currentSignature && (
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Salvar Atual
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Salvar Assinatura</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signature-name">Nome da Assinatura</Label>
                <Input
                  id="signature-name"
                  value={newSignatureName}
                  onChange={(e) => setNewSignatureName(e.target.value)}
                  placeholder="Ex: Assinatura Principal, Assinatura Autorizada..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Preview da Assinatura</Label>
                <div className="border rounded-lg p-4 bg-muted/20">
                  <img
                    src={currentSignature}
                    alt="Preview"
                    className="max-w-full h-20 object-contain mx-auto"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveCurrentSignature}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}