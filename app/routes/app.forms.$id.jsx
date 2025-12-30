import { useLoaderData, useSubmit, useNavigation, Form as RemixForm, redirect, useRouteError, useActionData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page, Layout, Card, TextField, Button, BlockStack, Text, Select, Checkbox, InlineStack, Banner } from "@shopify/polaris";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import formEditorStyles from "../styles/form-editor.css?url";

export const links = () => [{ rel: "stylesheet", href: formEditorStyles }];

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  if (params.id === "new") {
    const existingCount = await db.form.count({
      where: { shop: session.shop },
    });
    if (existingCount > 0) {
      // Limit reached, redirect to the existing form or list
      const existingForm = await db.form.findFirst({
        where: { shop: session.shop },
      });
      return redirect(`/app/forms/${existingForm.id}`);
    }
    return { form: null };
  }

  const form = await db.form.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!form || form.shop !== session.shop) {
    return redirect("/app/forms");
  }

  return { form };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const content = formData.get("content");
  const fields = formData.get("fields");
  const buttonLabel = formData.get("buttonLabel");
  const disclaimer = formData.get("disclaimer");

  if (params.id === "new") {
    const existingCount = await db.form.count({
      where: { shop: session.shop },
    });
    if (existingCount > 0) {
      return { status: "error", message: "Form limit reached (Max 1)." };
    }

    const form = await db.form.create({
      data: {
        title,
        content,
        fields,
        buttonLabel,
        disclaimer,
        shop: session.shop,
      },
    });
    return redirect(`/app/forms/${form.id}`);
  } else {
    await db.form.update({
      where: { id: parseInt(params.id) },
      data: {
        title,
        content,
        fields,
        buttonLabel,
        disclaimer,
      },
    });
    return { status: "success" };
  }
};

export default function FormEditor() {
  const { form } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [title, setTitle] = useState(form?.title || "");
  const [content, setContent] = useState(form?.content || "");
  const [fields, setFields] = useState(form ? JSON.parse(form.fields) : []);
  const [buttonLabel, setButtonLabel] = useState(form?.buttonLabel || "Submit");
  const [disclaimer, setDisclaimer] = useState(form?.disclaimer || "");
  const [activeField, setActiveField] = useState(null);
  const [titleError, setTitleError] = useState(null);

  // Store initial state for change detection
  const initialTitle = useRef(form?.title || "");
  const initialContent = useRef(form?.content || "");
  const initialFields = useRef(form ? JSON.parse(form.fields) : []);
  const initialButtonLabel = useRef(form?.buttonLabel || "Submit");
  const initialDisclaimer = useRef(form?.disclaimer || "");

  useEffect(() => {
    if (actionData?.status === "success") {
      shopify.toast.show("Form saved");
      // Update initial state after successful save
      initialTitle.current = title;
      initialContent.current = content;
      initialFields.current = fields;
      initialButtonLabel.current = buttonLabel;
      initialDisclaimer.current = disclaimer;
    }
  }, [actionData]);

  // Field Types
  const fieldTypes = [
    { label: "Text (Single Line)", value: "text" },
    { label: "Text (Multi Line)", value: "textarea" },
    { label: "Email", value: "email" },
    { label: "Number", value: "number" },
    { label: "Dropdown", value: "select" },
    { label: "Checkbox", value: "checkbox" },
  ];

  const addField = (type) => {
    const newField = {
      id: Date.now().toString(),
      type,
      label: "New Field",
      required: false,
      options: [], // For select
    };
    setFields([...fields, newField]);
    setActiveField(newField.id);
  };

  const updateField = (id, key, value) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const removeField = (id) => {
    setFields(fields.filter(f => f.id !== id));
    if (activeField === id) setActiveField(null);
  };

  const handleSave = () => {
    if (!title.trim()) {
      setTitleError("Form title is required");
      shopify.toast.show("Form title is required");
      return;
    }

    const isTitleChanged = title !== initialTitle.current;
    const isContentChanged = content !== initialContent.current;
    const isFieldsChanged = JSON.stringify(fields) !== JSON.stringify(initialFields.current);
    const isButtonLabelChanged = buttonLabel !== initialButtonLabel.current;
    const isDisclaimerChanged = disclaimer !== initialDisclaimer.current;

    if (!isTitleChanged && !isContentChanged && !isFieldsChanged && !isButtonLabelChanged && !isDisclaimerChanged) {
      shopify.toast.show("No changes to save");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("content", content);
    formData.append("fields", JSON.stringify(fields));
    formData.append("buttonLabel", buttonLabel);
    formData.append("disclaimer", disclaimer);
    submit(formData, { method: "post" });
  };

  return (
    <Page
      title={form ? "Edit Form" : "Create New Form"}
      backAction={{ url: "/app/forms" }}
      primaryAction={{
        content: "Save",
        loading: isSaving,
        onAction: handleSave,
      }}
    >
      <Layout>
        {/* Left: Form Preview & Configuration */}
        <Layout.Section>
           <Card>
              <BlockStack gap="400">
                <TextField 
                  label="Form Title" 
                  value={title} 
                  onChange={(val) => {
                    setTitle(val);
                    if (titleError) setTitleError(null);
                  }} 
                  autoComplete="off" 
                  error={titleError}
                />
                 <TextField 
                  label="Content" 
                  value={content} 
                  onChange={setContent} 
                  autoComplete="off" 
                  multiline={4}
                />
                
                <div className="form-preview-container">
                    <Text variant="headingSm" as="h5">Form Preview</Text>
                    <div className="preview-header">
                         <Text variant="headingXl" as="h2">{title || "Form Title"}</Text>
                         {content && <div className="preview-content" key="content" suppressHydrationWarning>{content}</div>}
                    </div>
                    <div className="preview-fields-container">
                        {fields.length === 0 && <Text tone="subdued">No fields added yet.</Text>}
                        {fields.map((field) => (
                          <div 
                              key={field.id} 
                              onClick={() => setActiveField(field.id)}
                              className={`preview-field-item ${activeField === field.id ? 'active' : ''}`}
                          >
                              <label className="preview-field-label">
                                  {field.label} {field.required && <span className="required-star">*</span>}
                              </label>
                              {field.type === 'textarea' ? (
                                  <textarea disabled className="preview-textarea" autoComplete="off" />
                              ) : field.type === 'select' ? (
                                  <select disabled className="preview-input" autoComplete="off">
                                      <option>Select...</option>
                                      {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                                  </select>
                              ) : field.type === 'checkbox' ? (
                                  <input type="checkbox" disabled className="preview-checkbox" autoComplete="off" />
                              ) : (
                                  <input type={field.type} disabled className="preview-input" autoComplete="off" />
                              )}
                          </div>
                        ))}
                    </div>
                    {/* Submit Button Preview */}
                     <div className="preview-submit-wrapper">
                        <Button variant="primary" fullWidth size="large">{buttonLabel || "Submit"}</Button>
                        {disclaimer && (
                            <div className="preview-disclaimer" key="disclaimer">
                              <Text variant="bodySm" tone="subdued">{disclaimer}</Text>
                            </div>
                         )}
                     </div>
                </div>
              </BlockStack>
           </Card>
        </Layout.Section>

        {/* Right: Toolbox */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
             <Card>
                <BlockStack gap="400">
                    <Text variant="headingSm" as="h5">Add Field</Text>
                    <InlineStack gap="200" wrap>
                        {fieldTypes.map(ft => (
                            <Button key={ft.value} onClick={() => addField(ft.value)} size="micro">{ft.label}</Button>
                        ))}
                    </InlineStack>
                </BlockStack>
             </Card>

             <Card>
                <BlockStack gap="400">
                    <Text variant="headingSm" as="h5">Submit Button Settings</Text>
                    <TextField 
                        label="Button label" 
                        value={buttonLabel} 
                        onChange={setButtonLabel} 
                        autoComplete="off" 
                    />
                    <TextField 
                        label="Consent disclaimer (optional)" 
                        value={disclaimer} 
                        onChange={setDisclaimer} 
                        autoComplete="off" 
                        multiline={3}
                        helpText="Displayed below the submit button."
                    />
                </BlockStack>
             </Card>

             {activeField && (
               <Card>
                   <BlockStack gap="400">
                      <Text variant="headingSm" as="h5">Edit Field</Text>
                      {(() => {
                          const field = fields.find(f => f.id === activeField);
                          if (!field) return null;
                          return (
                              <>
                                  <TextField 
                                      label="Label" 
                                      value={field.label} 
                                      onChange={(val) => updateField(field.id, 'label', val)} 
                                      autoComplete="off"
                                  />
                                  <Checkbox 
                                      label="Required" 
                                      checked={field.required} 
                                      onChange={(val) => updateField(field.id, 'required', val)} 
                                  />
                                  {field.type === 'select' && (
                                     <TextField
                                         label="Options (comma separated)"
                                         value={field.options?.join(', ')}
                                         onChange={(val) => updateField(field.id, 'options', val.split(',').map(s => s.trim()))}
                                         autoComplete="off"
                                         helpText="Example: Red, Blue, Green"
                                     />
                                  )}
                                  <Button tone="critical" onClick={() => removeField(field.id)}>Remove Field</Button>
                              </>
                          );
                      })()}
                   </BlockStack>
               </Card>
             )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
