import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type your response...",
  disabled = false
}) {
  return (
    <div className="space-y-2">
      <Textarea value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
      <div className="flex justify-end">
        <Button disabled={disabled || !value?.trim()} onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}
