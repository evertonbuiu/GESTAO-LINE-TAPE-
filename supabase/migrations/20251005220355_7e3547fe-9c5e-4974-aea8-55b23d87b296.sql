-- Remover colaboradores duplicados usando created_at para manter o mais recente
DELETE FROM public.event_collaborators 
WHERE id IN (
  SELECT ec.id
  FROM public.event_collaborators ec
  WHERE ec.reference_type = 'daily_rate'
    AND ec.reference_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.event_collaborators ec2
      WHERE ec2.reference_type = 'daily_rate'
        AND ec2.reference_id = ec.reference_id
        AND ec2.created_at > ec.created_at
    )
);