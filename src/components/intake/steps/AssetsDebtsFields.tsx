"use client";

import { useEffect } from "react";
import { useFieldArray, useWatch, type UseFormSetValue } from "react-hook-form";

import type { AssetsDebts } from "@/domain/intake";
import { Alert } from "@/components/ui";

import { CheckboxField, MoneyField, SelectField, TextField, TextareaField, YesNoField } from "../fields";
import { secondaryButtonClasses, dangerLinkClasses } from "../fields/inputStyles";
import type { StepFieldsProps } from "./StepFieldsProps";

const CATEGORY_OPTIONS = [
  { value: "realProperty", label: "Real property (home, land)" },
  { value: "retirementAccount", label: "Retirement account or pension" },
  { value: "bankAccount", label: "Bank / savings account" },
  { value: "investment", label: "Investment account" },
  { value: "vehicle", label: "Vehicle" },
  { value: "business", label: "Business interest" },
  { value: "personalProperty", label: "Personal property (furniture, jewelry, etc.)" },
  { value: "creditCardDebt", label: "Credit card debt" },
  { value: "loan", label: "Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "other", label: "Other" },
];

const TYPE_OPTIONS = [
  { value: "asset", label: "Something you own (asset)" },
  { value: "liability", label: "Something you owe (debt)" },
];

const CLASSIFICATION_OPTIONS = [
  { value: "marital", label: "Marital — shared by the marriage" },
  { value: "presumedMarital", label: "Probably marital — got it during the marriage" },
  { value: "nonmarital", label: "Separate — one spouse's own property" },
  { value: "disputed", label: "Disputed — the two of you disagree" },
];

const OWNER_OPTIONS = [
  { value: "a", label: "You" },
  { value: "b", label: "Your spouse" },
  { value: "joint", label: "Both (joint)" },
];

const NONMARITAL_BASIS_OPTIONS = [
  { value: "acquiredBeforeMarriage", label: "Owned before the marriage" },
  { value: "separateGiftOrInheritance", label: "A gift or inheritance to one spouse only" },
  { value: "incomeFromNonmaritalAsset", label: "Income from separate (nonmarital) property" },
  { value: "forgeryLiability", label: "A debt created by the other spouse's forgery" },
  { value: "separatelyAcquiredRealProperty", label: "Real property acquired separately" },
];

function generateItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type Errors = StepFieldsProps<AssetsDebts>["errors"];
type Register = StepFieldsProps<AssetsDebts>["register"];

interface ItemFieldsProps {
  index: number;
  register: Register;
  errors: Errors;
  control: StepFieldsProps<AssetsDebts>["control"];
  setValue: UseFormSetValue<AssetsDebts>;
  writtenAgreementConfirmed: boolean;
  onRemove: () => void;
}

/** One asset/liability row. Its own component so it can watch its own classification. */
function AssetDebtItemFields({
  index,
  register,
  errors,
  control,
  setValue,
  writtenAgreementConfirmed,
  onRemove,
}: ItemFieldsProps) {
  const classification = useWatch({ control, name: `items.${index}.classification` });
  const excluded = useWatch({ control, name: `items.${index}.excludedByWrittenAgreement` });
  const isNonmarital = classification === "nonmarital";
  const itemErrors = errors.items?.[index];

  // Keep the stored data internally consistent as the classification changes:
  // separate (nonmarital) property is set apart automatically, so it can't also
  // be "excluded by agreement", and only separate property carries a statutory
  // basis. Clearing these prevents stale values from silently blocking the step.
  useEffect(() => {
    if (isNonmarital && excluded) {
      setValue(`items.${index}.excludedByWrittenAgreement`, false);
    }
    if (!isNonmarital) {
      setValue(`items.${index}.nonmaritalBasis`, undefined);
    }
  }, [isNonmarital, excluded, index, setValue]);

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-base font-semibold text-ink">Item {index + 1}</legend>

      <TextField
        id={`items.${index}.label`}
        label="What is it?"
        required
        placeholder="e.g. Family home, Honda Civic, Chase credit card"
        registration={register(`items.${index}.label`)}
        error={itemErrors?.label?.message}
      />

      <SelectField
        id={`items.${index}.type`}
        label="Is this something you own or owe?"
        options={TYPE_OPTIONS}
        registration={register(`items.${index}.type`)}
        error={itemErrors?.type?.message}
      />

      <SelectField
        id={`items.${index}.category`}
        label="Category"
        options={CATEGORY_OPTIONS}
        registration={register(`items.${index}.category`)}
        error={itemErrors?.category?.message}
      />

      <MoneyField
        id={`items.${index}.value`}
        label="Approximate value"
        hint="For a debt, enter how much is owed as a positive number."
        registration={register(`items.${index}.value`)}
        error={itemErrors?.value?.message}
      />

      <SelectField
        id={`items.${index}.owner`}
        label="Who holds it?"
        options={OWNER_OPTIONS}
        registration={register(`items.${index}.owner`)}
        error={itemErrors?.owner?.message}
      />

      <SelectField
        id={`items.${index}.classification`}
        label="Is this shared (marital) or separate (nonmarital) property?"
        hint="Marital property is generally split; separate property is set aside to the spouse who owns it."
        options={CLASSIFICATION_OPTIONS}
        registration={register(`items.${index}.classification`)}
        error={itemErrors?.classification?.message}
      />

      {isNonmarital ? (
        <SelectField
          id={`items.${index}.nonmaritalBasis`}
          label="Why is it separate property?"
          hint="Florida only sets property aside for specific reasons (Fla. Stat. §61.075(6)(b))."
          options={[{ value: "", label: "Choose a reason…" }, ...NONMARITAL_BASIS_OPTIONS]}
          registration={register(`items.${index}.nonmaritalBasis`)}
          error={itemErrors?.nonmaritalBasis?.message}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <CheckboxField
            id={`items.${index}.excludedByWrittenAgreement`}
            label="Leave this item out of the shared (marital) estate by written agreement"
            hint="Only check this if both spouses have agreed — in writing — to keep this item out of the split. You confirm that agreement exists in the box at the end of this section."
            registration={register(`items.${index}.excludedByWrittenAgreement`)}
            error={itemErrors?.excludedByWrittenAgreement?.message}
          />
          {excluded && !writtenAgreementConfirmed ? (
            <Alert variant="warning" role="status" className="text-sm">
              You&apos;ve marked this item to be left out, but haven&apos;t yet confirmed a written agreement below.
              Until you do, this item stays in the shared estate — one spouse can&apos;t remove it on their own.
            </Alert>
          ) : null}
        </div>
      )}

      <button type="button" onClick={onRemove} className={`${dangerLinkClasses} self-start`}>
        Remove item {index + 1}
      </button>
    </fieldset>
  );
}

export function AssetsDebtsFields({ register, errors, control, setValue }: StepFieldsProps<AssetsDebts>) {
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const writtenAgreementConfirmed = Boolean(useWatch({ control, name: "writtenAgreementConfirmed" }));
  const watchedItems = (useWatch({ control, name: "items" }) ?? []) as AssetsDebts["items"];
  const anyExcluded = watchedItems.some(
    (item) => item?.excludedByWrittenAgreement && item?.classification !== "nonmarital",
  );

  return (
    <div className="flex flex-col gap-6">
      <Alert variant="info" role="note" className="text-sm">
        <p>
          List each major asset and debt separately. For each one you&apos;ll say who holds it and whether it&apos;s
          shared (marital) or separate (nonmarital) property. Florida starts from an <strong>equal split</strong> of
          the shared estate, so itemizing is what lets us show the effect of every choice.
        </p>
      </Alert>

      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <AssetDebtItemFields
            key={field.id}
            index={index}
            register={register}
            errors={errors}
            control={control}
            setValue={setValue}
            writtenAgreementConfirmed={writtenAgreementConfirmed}
            onRemove={() => remove(index)}
          />
        ))}
        <button
          type="button"
          onClick={() =>
            append({
              id: generateItemId(),
              label: "",
              category: "bankAccount",
              type: "asset",
              value: 0,
              classification: "marital",
              owner: "joint",
              excludedByWrittenAgreement: false,
            })
          }
          className={`${secondaryButtonClasses} self-start`}
        >
          + Add an asset or debt
        </button>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-base font-semibold text-ink">Written agreement to exclude items</legend>
        <p className="text-sm text-ink-muted">
          Florida only lets you keep an item out of the shared estate if{" "}
          <strong>both spouses have agreed in writing</strong> (Fla. Stat. §61.075(6)(b)4). Check the box below only if
          that written agreement exists (or will). If you don&apos;t, any items you marked above stay in the shared
          estate.
        </p>
        <CheckboxField
          id="writtenAgreementConfirmed"
          label="Both spouses have a written agreement covering the items marked to be left out."
          registration={register("writtenAgreementConfirmed")}
          error={errors.writtenAgreementConfirmed?.message}
        />
        {anyExcluded && !writtenAgreementConfirmed ? (
          <Alert variant="warning" role="alert" className="text-sm">
            You marked one or more items to be left out of the shared estate but haven&apos;t confirmed a written
            agreement. Those items will be kept in the estate until you do.
          </Alert>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-base font-semibold text-ink">Special situations</legend>
        <p className="text-sm text-ink-muted">
          These situations don&apos;t have a simple formula. If any apply, we&apos;ll flag your case for a professional
          review instead of guessing a number.
        </p>
        <CheckboxField
          id="unequalDistributionRequested"
          label="One spouse is asking for an unequal (not 50/50) split."
          hint="Florida starts from an equal split; any other split is up to a judge."
          registration={register("unequalDistributionRequested")}
          error={errors.unequalDistributionRequested?.message}
        />
        <CheckboxField
          id="dissipationClaimPresent"
          label="One spouse claims the other wasted or hid marital money."
          registration={register("dissipationClaimPresent")}
          error={errors.dissipationClaimPresent?.message}
        />
        <CheckboxField
          id="nonmaritalMortgagePaydownClaimPresent"
          label="Marital money was used to pay down a mortgage on one spouse's separate property."
          registration={register("nonmaritalMortgagePaydownClaimPresent")}
          error={errors.nonmaritalMortgagePaydownClaimPresent?.message}
        />
      </fieldset>

      <YesNoField
        id="hasOtherSupportObligations"
        legend="Does either spouse already pay support from a different case?"
        required
        registration={register("hasOtherSupportObligations")}
        error={errors.hasOtherSupportObligations?.message}
      />
      <TextareaField
        id="otherSupportObligationsDetails"
        label="Briefly describe that other support obligation"
        hint="Only needed if you answered yes above."
        registration={register("otherSupportObligationsDetails")}
        error={errors.otherSupportObligationsDetails?.message}
      />
      <YesNoField
        id="hasHiddenOrUnknownAssets"
        legend="Do you suspect your spouse has assets you don't know about, or that aren't being disclosed?"
        hint="This is common and nothing to be embarrassed about — it just means a real attorney's tools may help."
        required
        registration={register("hasHiddenOrUnknownAssets")}
        error={errors.hasHiddenOrUnknownAssets?.message}
      />
      <YesNoField
        id="hasComplexBusinessInterests"
        legend="Does either spouse own a business, or have income that's hard to pin down (e.g. commission-heavy or self-employed)?"
        required
        registration={register("hasComplexBusinessInterests")}
        error={errors.hasComplexBusinessInterests?.message}
      />
    </div>
  );
}
